use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicBool, Ordering};
use serde_json::Value;
use sha2::{Sha256, Digest};
use uuid::Uuid;
use base64::prelude::*;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::broadcast;

// Friends-related structures
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct FriendStatus {
    pub user_id: String,
    pub online_status: String,
    pub world_name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ResoniteCredentials {
    pub identity: String,
    pub password: String,
}

pub struct FriendsConnection {
    pub is_connected: bool,
    pub session_token: Option<String>,
    pub user_id: Option<String>,
    pub machine_id: String,
    pub secret_machine_id: String,
}

impl Default for FriendsConnection {
    fn default() -> Self {
        Self {
            is_connected: false,
            session_token: None,
            user_id: None,
            machine_id: BASE64_STANDARD.encode(Uuid::new_v4().as_bytes()),
            secret_machine_id: Uuid::new_v4().to_string(),
        }
    }
}

// Session cache for world information
static SESSION_CACHE: std::sync::Mutex<Vec<serde_json::Value>> = std::sync::Mutex::new(Vec::new());

// Friends cache for status display
static FRIENDS_CACHE: OnceLock<Mutex<HashMap<String, FriendStatus>>> = OnceLock::new();

// Global shutdown channel for stopping connections
static SHUTDOWN_SENDER: std::sync::Mutex<Option<broadcast::Sender<()>>> = std::sync::Mutex::new(None);

// Message statistics
static MESSAGE_STATS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();

// Helper function to generate SHA256 hash
fn sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

// Update message statistics
fn update_message_stats(target: &str) {
    let stats_cache = MESSAGE_STATS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut stats = stats_cache.lock().unwrap();
    *stats.entry(target.to_string()).or_insert(0) += 1;
}

// Display message statistics
fn display_message_stats() {
    let stats_cache = MESSAGE_STATS.get_or_init(|| Mutex::new(HashMap::new()));
    let stats = stats_cache.lock().unwrap();
    if stats.is_empty() {
        return;
    }
    
    println!("\n================= MESSAGE STATISTICS =================");
    for (message_type, count) in stats.iter() {
        println!("{:<30} {:>10}", message_type, count);
    }
    println!("======================================================\n");
}

// Display friends table like Node.js version
fn display_friends_table() {
    let friends_cache = FRIENDS_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let friends = friends_cache.lock().unwrap();
    if friends.is_empty() {
        return;
    }
    
    println!("\n================= FRIENDS STATUS =================");
    println!("{:<15} {:<12} {:<20}", "User ID", "Status", "World Name");
    println!("{}", "-".repeat(50));
    
    for (user_id, friend_status) in friends.iter() {
        let world_name = friend_status.world_name.as_deref().unwrap_or("Private");
        println!("{:<15} {:<12} {:<20}", user_id, friend_status.online_status, world_name);
    }
    
    println!("==================================================\n");
}

// Update session cache periodically
async fn update_session_cache_loop(mut shutdown_rx: broadcast::Receiver<()>) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
    
    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                println!("[FRIENDS DEBUG] Session cache update loop shutting down");
                break;
            }
            _ = interval.tick() => {
                if let Err(e) = update_session_cache().await {
                    println!("[FRIENDS DEBUG] Failed to update session cache: {}", e);
                    continue;
                }
                
                println!("[FRIENDS DEBUG] Session cache updated successfully");
            }
        }
    }
}

// Update session cache from API
async fn update_session_cache() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("[FRIENDS DEBUG] Updating session cache");
    
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.resonite.com/sessions?includeEmptyHeadless=false&minActiveUsers=1")
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("Session API returned: {}", response.status()).into());
    }
    
    let sessions: Vec<serde_json::Value> = response.json().await?;
    println!("[FRIENDS DEBUG] Retrieved {} sessions", sessions.len());
    
    {
        let mut cache = SESSION_CACHE.lock().unwrap();
        *cache = sessions;
    }
    
    Ok(())
}

// Get world name from session cache
fn get_world_name_from_cache(user_id: &str) -> Option<String> {
    let cache = SESSION_CACHE.lock().unwrap();
    
    for session in cache.iter() {
        if let Some(users) = session["sessionUsers"].as_array() {
            for user in users {
                if let (Some(uid), Some(is_present)) = (
                    user["userID"].as_str(),
                    user["isPresent"].as_bool(),
                ) {
                    if uid == user_id && is_present {
                        if let Some(world_name) = session["name"].as_str() {
                            println!("[FRIENDS DEBUG] Found world for {}: {}", user_id, world_name);
                            return Some(world_name.to_string());
                        }
                    }
                }
            }
        }
    }
    
    println!("[FRIENDS DEBUG] No world found for user: {}", user_id);
    None
}

// SignalR negotiation structure
#[derive(serde::Deserialize, Debug)]
struct SignalRNegotiateResponse {
    #[serde(rename = "connectionToken")]
    connection_token: String,
    #[serde(rename = "connectionId")]
    connection_id: String,
    #[serde(rename = "availableTransports")]
    available_transports: Vec<serde_json::Value>,
    #[serde(rename = "useStatefulReconnect")]
    use_stateful_reconnect: Option<bool>,
}

// Perform SignalR negotiation via HTTP (replicating @microsoft/signalr behavior)
async fn signalr_negotiate(auth_header: &str) -> Result<SignalRNegotiateResponse, Box<dyn std::error::Error + Send + Sync>> {
    println!("[FRIENDS DEBUG] Performing SignalR negotiation with auth: {}", auth_header);
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.resonite.com/hub/negotiate?negotiateVersion=1")
        .header("Authorization", auth_header)
        .header("Content-Type", "application/json")
        .header("User-Agent", "Microsoft SignalR/8.0 (8.0.7; Unknown OS; Rust)")
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("Negotiation failed: {}", response.status()).into());
    }
    
    let response_text = response.text().await?;
    println!("[FRIENDS DEBUG] Raw negotiation response: {}", response_text);
    
    let negotiate_response: SignalRNegotiateResponse = serde_json::from_str(&response_text)?;
    println!("[FRIENDS DEBUG] Parsed negotiation response: {:?}", negotiate_response);
    println!("[FRIENDS DEBUG] Connection token: {}", &negotiate_response.connection_token[..std::cmp::min(20, negotiate_response.connection_token.len())]);
    
    Ok(negotiate_response)
}

// Handle incoming SignalR messages with ACK support
async fn handle_signalr_message(text: &str, ack_tx: Option<tokio::sync::mpsc::UnboundedSender<String>>) {
    println!("[FRIENDS DEBUG] Raw message length: {} bytes", text.len());
    
    // Log very large messages specially
    if text.len() > 100000 {
        println!("[FRIENDS DEBUG] *** LARGE MESSAGE DETECTED ({}B) - This might be the friends list! ***", text.len());
        // Only show first 500 chars of very large messages
        let preview = if text.len() > 500 { &text[..500] } else { text };
        println!("[FRIENDS DEBUG] Large message preview: {}...", preview);
    }
    
    // Track ACK counter (starts at 1 and increments for each invocation message)
    static ACK_COUNTER: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(1);
    
    // SignalR messages are separated by ASCII character 0x1E
    for message_part in text.split('\u{1e}') {
        if message_part.trim().is_empty() {
            continue;
        }
        
        if message_part.len() > 500 {
            println!("[FRIENDS DEBUG] Processing large message part ({} bytes)", message_part.len());
        } else {
            println!("[FRIENDS DEBUG] Processing message part: {}", message_part);
        }
        
        if let Ok(msg) = serde_json::from_str::<serde_json::Value>(message_part) {
            let msg_type = msg["type"].as_u64().unwrap_or(0);
            println!("[FRIENDS DEBUG] Message type: {}", msg_type);
            
            match msg_type {
                1 => {
                    // For invocation messages, schedule ACK to be sent after 1 second (like Node.js)
                    let current_ack_id = ACK_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    println!("[FRIENDS DEBUG] Invocation message received, will send ACK with sequence ID: {}", current_ack_id);
                    
                    if let Some(ack_tx) = &ack_tx {
                        let ack_tx_clone = ack_tx.clone();
                        tokio::spawn(async move {
                            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                            let ack_msg = serde_json::json!({
                                "type": 8,
                                "sequenceId": current_ack_id
                            });
                            let ack_text = format!("{}\u{1e}", serde_json::to_string(&ack_msg).unwrap());
                            if let Err(e) = ack_tx_clone.send(ack_text) {
                                println!("[FRIENDS DEBUG] Failed to queue delayed ACK: {}", e);
                            }
                        });
                    }
                    // Invocation message (type 1)
                    let target = msg["target"].as_str().unwrap_or("");
                    let arguments = msg["arguments"].as_array();
                    
                    println!("[FRIENDS DEBUG] Received invocation: {} (original case)", target);
                    println!("[FRIENDS DEBUG] Received invocation: {} (lowercase)", target.to_lowercase());
                    
                    // Update statistics
                    update_message_stats(target);
                    
                    match target.to_lowercase().as_str() {
                        "receivestatusupdate" => {
                            println!("[FRIENDS DEBUG] Processing ReceiveStatusUpdate message");
                            if let Some(args) = arguments {
                                if let Some(status_data) = args.get(0) {
                                    handle_status_update(status_data).await;
                                } else {
                                    println!("[FRIENDS DEBUG] ReceiveStatusUpdate: No status data in arguments");
                                }
                            } else {
                                println!("[FRIENDS DEBUG] ReceiveStatusUpdate: No arguments provided");
                            }
                        },
                        "receivesessionupdate" => {
                            if let Some(args) = arguments {
                                if let Some(session_data) = args.get(0) {
                                    handle_session_update(session_data).await;
                                }
                            }
                        },
                        "removesession" => {
                            if let Some(args) = arguments {
                                if let Some(session_id) = args.get(0).and_then(|v| v.as_str()) {
                                    handle_remove_session(session_id).await;
                                }
                            }
                        },
                        "sendstatustouser" => {
                            println!("[FRIENDS DEBUG] Received SendStatusToUser message");
                            if let Some(args) = arguments {
                                println!("[FRIENDS DEBUG] SendStatusToUser arguments: {:?}", args);
                            }
                        },
                        "debug" => {
                            println!("[FRIENDS DEBUG] Received debug message");
                            if let Some(args) = arguments {
                                println!("[FRIENDS DEBUG] Debug arguments: {:?}", args);
                            }
                        },
                        _ => {
                            println!("[FRIENDS DEBUG] Unknown invocation target: {}", target);
                        }
                    }
                },
                2 => {
                    println!("[FRIENDS DEBUG] Received stream invocation message");
                },
                3 => {
                    // Completion message - check if it's for InitializeStatus
                    let invocation_id = msg["invocationId"].as_str().unwrap_or("");
                    let error = msg["error"].as_str();
                    let result = &msg["result"];
                    
                    println!("[FRIENDS DEBUG] Received completion for invocation {}", invocation_id);
                    if let Some(err) = error {
                        println!("[FRIENDS DEBUG] Completion error: {}", err);
                    }
                    if !result.is_null() {
                        println!("[FRIENDS DEBUG] Completion result: {}", serde_json::to_string_pretty(result).unwrap_or_default());
                    }
                    
                    // Special handling for InitializeStatus completion (invocationId = "0")
                    if invocation_id == "0" {
                        println!("[FRIENDS DEBUG] InitializeStatus completed successfully!");
                        // Check if there's any special data in the result
                        println!("[FRIENDS DEBUG] Full completion message: {}", serde_json::to_string_pretty(&msg).unwrap_or_default());
                    }
                },
                4 => {
                    println!("[FRIENDS DEBUG] Received stream item message");
                },
                5 => {
                    println!("[FRIENDS DEBUG] Received cancel invocation message");
                },
                6 => {
                    println!("[FRIENDS DEBUG] Received ping");
                },
                7 => {
                    println!("[FRIENDS DEBUG] Received close message");
                },
                8 => {
                    // ACK message
                    let ack_sequence_id = msg["sequenceId"].as_u64().unwrap_or(0);
                    println!("[FRIENDS DEBUG] Received ACK for sequence ID: {}", ack_sequence_id);
                },
                9 => {
                    // Sequence message - server requesting resend from specific sequence
                    let sequence_id = msg["sequenceId"].as_u64().unwrap_or(0);
                    println!("[FRIENDS DEBUG] Received Sequence message, resend from ID: {}", sequence_id);
                },
                _ => {
                    println!("[FRIENDS DEBUG] Unknown message type: {}", msg_type);
                }
            }
        } else {
            println!("[FRIENDS DEBUG] Failed to parse message: {}", message_part);
        }
    }
}

// Handle ReceiveStatusUpdate messages
async fn handle_status_update(status_data: &serde_json::Value) {
    println!("[FRIENDS DEBUG] ===== RECEIVESTATUSUPDATE EVENT =====");
    println!("[FRIENDS DEBUG] Status data: {}", serde_json::to_string_pretty(status_data).unwrap_or_default());
    
    let user_id = status_data["userId"].as_str().unwrap_or("");
    let online_status = status_data["onlineStatus"].as_str().unwrap_or("Offline");
    
    println!("[FRIENDS DEBUG] User: {}, Status: {}", user_id, online_status);
    
    // Get world name from session cache
    let world_name = if online_status == "Online" {
        get_world_name_from_cache(user_id)
    } else {
        None
    };
    
    let friend_status = FriendStatus {
        user_id: user_id.replace("U-", ""),
        online_status: online_status.to_string(),
        world_name,
    };
    
    // Update friends cache
    {
        let friends_cache = FRIENDS_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        let mut friends = friends_cache.lock().unwrap();
        friends.insert(friend_status.user_id.clone(), friend_status);
    }
    
    // Display friends table
    display_friends_table();
    
    println!("[FRIENDS DEBUG] ===== END RECEIVESTATUSUPDATE =====");
}

// Handle ReceiveSessionUpdate messages
async fn handle_session_update(session_data: &serde_json::Value) {
    let session_id = session_data["sessionId"].as_str().unwrap_or("");
    
    // Update session cache immediately
    {
        let mut cache = SESSION_CACHE.lock().unwrap();
        // Check if session already exists in cache
        if let Some(pos) = cache.iter().position(|s| s["sessionId"].as_str().unwrap_or("") == session_id) {
            cache[pos] = session_data.clone();
        } else {
            cache.push(session_data.clone());
        }
    }
}

// Handle RemoveSession messages
async fn handle_remove_session(session_id: &str) {
    println!("[FRIENDS DEBUG] Removing session: {}", session_id);
    
    // Remove from session cache
    {
        let mut cache = SESSION_CACHE.lock().unwrap();
        cache.retain(|s| s["sessionId"].as_str().unwrap_or("") != session_id);
        println!("[FRIENDS DEBUG] Session removed. Total sessions: {}", cache.len());
    }
}

// Start SignalR connection for real-time updates using WebSocket
async fn start_signalr_connection(
    auth_header: String,
    mut shutdown_rx: broadcast::Receiver<()>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    println!("[FRIENDS DEBUG] Attempting to connect to SignalR hub with auth: {}", auth_header);
    
    // Step 1: Perform SignalR negotiation via HTTP
    let negotiate_result = signalr_negotiate(&auth_header).await?;
    println!("[FRIENDS DEBUG] SignalR negotiation completed: {:?}", negotiate_result);
    
    // Step 2: Connect to WebSocket with connection token
    let ws_url = format!("wss://api.resonite.com/hub?id={}", negotiate_result.connection_token);
    println!("[FRIENDS DEBUG] Connecting to WebSocket: wss://api.resonite.com/hub?id=...");
    
    // Connect without custom headers to avoid WebSocket protocol issues
    let (ws_stream, _response) = connect_async(&ws_url).await?;
    println!("[FRIENDS DEBUG] WebSocket connection established");
    
    let (ws_sender, mut ws_receiver) = ws_stream.split();
    let (mut ws_sender_main, mut ws_sender_ack) = {
        // Split the sender for main operations and ACK operations
        use std::sync::Arc;
        use tokio::sync::Mutex;
        let sender = Arc::new(Mutex::new(ws_sender));
        (sender.clone(), sender)
    };
    
    // Create ACK channel for message acknowledgments
    let (ack_tx, mut ack_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    
    // Shared state for handshake completion
    let handshake_complete = Arc::new(AtomicBool::new(false));
    
    // Step 3: Send SignalR handshake message
    // Use version 2 if server supports stateful reconnect, otherwise version 1
    let protocol_version = if negotiate_result.use_stateful_reconnect.unwrap_or(false) { 2 } else { 1 };
    println!("[FRIENDS DEBUG] Using protocol version: {} (stateful reconnect: {})", 
             protocol_version, negotiate_result.use_stateful_reconnect.unwrap_or(false));
    
    let handshake_msg = serde_json::json!({
        "protocol": "json",
        "version": protocol_version
    });
    let handshake_text = format!("{}\u{1e}", serde_json::to_string(&handshake_msg)?);
    println!("[FRIENDS DEBUG] Sending handshake ({} bytes): {}", handshake_text.len(), handshake_text.trim_end_matches('\u{1e}'));
    ws_sender_main.lock().await.send(Message::Text(handshake_text)).await?;
    
    // Step 4: Handle incoming messages in a separate task with message buffering
    let handshake_complete_clone = handshake_complete.clone();
    let ack_tx_clone = ack_tx.clone();
    let mut receive_task = tokio::spawn(async move {
        let mut local_handshake_complete = false;
        let mut first_message = true;
        let mut message_buffer = String::new();
        
        while let Some(message) = ws_receiver.next().await {
            match message {
                Ok(Message::Text(text)) => {
                    if !local_handshake_complete && first_message {
                        // First message should be handshake response
                        if text.trim().is_empty() || text.trim() == "{}" || text.trim().ends_with('\u{1e}') {
                            println!("[FRIENDS DEBUG] Handshake successful: {}", text);
                            local_handshake_complete = true;
                            handshake_complete_clone.store(true, Ordering::Relaxed);
                        } else {
                            println!("[FRIENDS DEBUG] Unexpected handshake response, treating as normal message: {}", text);
                            // Treat as normal message if it's not empty handshake
                            local_handshake_complete = true;
                            handshake_complete_clone.store(true, Ordering::Relaxed);
                            handle_signalr_message(&text, Some(ack_tx_clone.clone())).await;
                        }
                        first_message = false;
                    } else {
                        // Handle message buffering for potentially large/split messages
                        message_buffer.push_str(&text);
                        
                        // Process complete messages that end with SignalR separator
                        if text.ends_with('\u{1e}') {
                            println!("[FRIENDS DEBUG] Complete message received (total length: {} bytes)", message_buffer.len());
                            handle_signalr_message(&message_buffer, Some(ack_tx_clone.clone())).await;
                            message_buffer.clear();
                        } else {
                            println!("[FRIENDS DEBUG] Partial message received ({} bytes), buffering...", text.len());
                        }
                    }
                },
                Ok(Message::Binary(data)) => {
                    println!("[FRIENDS DEBUG] Received binary message ({} bytes)", data.len());
                    // Convert binary to string if needed
                    if let Ok(text) = String::from_utf8(data) {
                        message_buffer.push_str(&text);
                        if text.ends_with('\u{1e}') {
                            println!("[FRIENDS DEBUG] Complete binary message converted to text ({} bytes)", message_buffer.len());
                            handle_signalr_message(&message_buffer, Some(ack_tx_clone.clone())).await;
                            message_buffer.clear();
                        }
                    }
                },
                Ok(Message::Close(_)) => {
                    println!("[FRIENDS DEBUG] WebSocket connection closed");
                    break;
                },
                Err(e) => {
                    println!("[FRIENDS DEBUG] WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });
    
    // Step 5: Wait for handshake completion
    println!("[FRIENDS DEBUG] Waiting for handshake completion...");
    let mut wait_count = 0;
    while !handshake_complete.load(Ordering::Relaxed) && wait_count < 50 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        wait_count += 1;
    }
    
    if !handshake_complete.load(Ordering::Relaxed) {
        println!("[FRIENDS DEBUG] WARNING: Handshake may not have completed, proceeding anyway");
    } else {
        println!("[FRIENDS DEBUG] Handshake completed successfully!");
        
        // Send the critical 11-byte message after handshake (similar to Node.js SignalR library)
        let ping_msg = serde_json::json!({"type": 6});
        let ping_text = format!("{}\u{1e}", serde_json::to_string(&ping_msg)?);
        println!("[FRIENDS DEBUG] Sending post-handshake ping ({} bytes): {}", ping_text.len(), ping_text.trim_end_matches('\u{1e}'));
        ws_sender_main.lock().await.send(Message::Text(ping_text)).await?;
        
        // Send Sequence message to activate MessageBuffer system (only if stateful reconnect is supported)
        if negotiate_result.use_stateful_reconnect.unwrap_or(false) {
            let sequence_msg = serde_json::json!({
                "type": 9,
                "sequenceId": 1
            });
            let sequence_text = format!("{}\u{1e}", serde_json::to_string(&sequence_msg)?);
            println!("[FRIENDS DEBUG] Sending Sequence message to activate MessageBuffer ({} bytes): {}", sequence_text.len(), sequence_text.trim_end_matches('\u{1e}'));
            ws_sender_main.lock().await.send(Message::Text(sequence_text)).await?;
        } else {
            println!("[FRIENDS DEBUG] Skipping Sequence message - stateful reconnect not supported by server");
        }
        
        // Wait a moment for any response
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }
    
    
    // Step 7: Send InitializeStatus invocation with invocationId (start from 0 like Node.js)
    let init_status_msg = serde_json::json!({
        "type": 1,
        "invocationId": "0",  // Start from 0 like Node.js does
        "target": "InitializeStatus",
        "arguments": []
    });
    let init_status_text = format!("{}\u{1e}", serde_json::to_string(&init_status_msg)?);
    println!("[FRIENDS DEBUG] Sending InitializeStatus ({} bytes): {}", init_status_text.len(), init_status_text.trim_end_matches('\u{1e}'));
    ws_sender_main.lock().await.send(Message::Text(init_status_text)).await?;
    println!("[FRIENDS DEBUG] InitializeStatus sent with invocationId=0, waiting for response...");
    
    // Wait a moment for initialization
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 8: Update session cache like Node.js does
    println!("[FRIENDS DEBUG] Updating session cache after InitializeStatus (like Node.js)...");
    if let Err(e) = update_session_cache().await {
        println!("[FRIENDS DEBUG] Failed to update session cache: {}", e);
    }
    
    // Additional wait after session cache update
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    
    // Step 9: Send RequestStatus invocation
    let request_status_msg = serde_json::json!({
        "type": 1,
        "invocationId": "1",  // Second invocation (after InitializeStatus=0)
        "target": "RequestStatus",
        "arguments": [null, false]
    });
    let request_status_text = format!("{}\u{1e}", serde_json::to_string(&request_status_msg)?);
    println!("[FRIENDS DEBUG] Sending RequestStatus ({} bytes): {}", request_status_text.len(), request_status_text.trim_end_matches('\u{1e}'));
    ws_sender_main.lock().await.send(Message::Text(request_status_text)).await?;
    
    // Step 10: Wait after RequestStatus (like Node.js does before entering main loop)
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    
    println!("[FRIENDS DEBUG] SignalR connection is now active, waiting for messages...");
    
    // Start session cache update loop now that SignalR is connected
    let shutdown_rx_clone = shutdown_rx.resubscribe();
    tokio::spawn(async move {
        update_session_cache_loop(shutdown_rx_clone).await;
    });
    
    // Start ACK message sender task for MessageBuffer simulation
    let mut shutdown_rx_ack = shutdown_rx.resubscribe();
    tokio::spawn(async move {
        loop {
            tokio::select! {
                Some(ack_msg) = ack_rx.recv() => {
                    println!("[FRIENDS DEBUG] Sending delayed ACK: {}", ack_msg.trim_end_matches('\u{1e}'));
                    if let Err(e) = ws_sender_ack.lock().await.send(Message::Text(ack_msg)).await {
                        println!("[FRIENDS DEBUG] Failed to send ACK message: {}", e);
                    }
                },
                _ = shutdown_rx_ack.recv() => {
                    println!("[FRIENDS DEBUG] ACK sender task shutting down");
                    break;
                }
            }
        }
    });
    
    // Keep the connection alive and monitor it
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
    loop {
        tokio::select! {
            _ = shutdown_rx.recv() => {
                println!("[FRIENDS DEBUG] Shutdown signal received, closing connection");
                let _ = ws_sender_main.lock().await.send(Message::Close(None)).await;
                break;
            }
            _ = interval.tick() => {
                // Send ping to keep connection alive
                let ping_msg = serde_json::json!({"type": 6});
                let ping_text = format!("{}\u{1e}", serde_json::to_string(&ping_msg)?);
                if let Err(e) = ws_sender_main.lock().await.send(Message::Text(ping_text)).await {
                    println!("[FRIENDS DEBUG] Failed to send ping: {}", e);
                    break;
                }
                println!("[FRIENDS DEBUG] Sent ping to keep connection alive");
            }
            result = &mut receive_task => {
                match result {
                    Ok(_) => println!("[FRIENDS DEBUG] Receive task completed"),
                    Err(e) => println!("[FRIENDS DEBUG] Receive task error: {}", e),
                }
                break;
            }
        }
    }
    
    println!("[FRIENDS DEBUG] SignalR connection ended");
    
    // Display final statistics
    display_message_stats();
    
    Ok(())
}

// Connect to Resonite friends API
async fn connect_resonite_friends(credentials: ResoniteCredentials) -> Result<String, String> {
    println!("[FRIENDS DEBUG] Starting connection process");
    
    let machine_id = BASE64_STANDARD.encode(Uuid::new_v4().as_bytes());
    let secret_machine_id = Uuid::new_v4().to_string();
    
    println!("[FRIENDS DEBUG] Machine ID: {}", machine_id);
    println!("[FRIENDS DEBUG] Secret Machine ID: {}", secret_machine_id);
    
    // Create SHA256 hash of machine ID for UID
    let uid = sha256_hash(&machine_id);
    println!("[FRIENDS DEBUG] Generated UID: {}", uid);
    
    // Prepare login credentials
    let mut login_credentials = serde_json::json!({
        "ownerId": null,
        "email": null,
        "userName": null,
        "authentication": {
            "$type": "password",
            "password": credentials.password
        },
        "secretMachineId": secret_machine_id,
        "rememberMe": false
    });
    
    // Determine credential type
    if credentials.identity.starts_with("U-") {
        login_credentials["ownerId"] = serde_json::Value::String(credentials.identity.clone());
        println!("[FRIENDS DEBUG] Using owner ID: {}", credentials.identity);
    } else if credentials.identity.contains("@") {
        login_credentials["email"] = serde_json::Value::String(credentials.identity.clone());
        println!("[FRIENDS DEBUG] Using email: {}", credentials.identity);
    } else {
        login_credentials["userName"] = serde_json::Value::String(credentials.identity.clone());
        println!("[FRIENDS DEBUG] Using username: {}", credentials.identity);
    }
    
    println!("[FRIENDS DEBUG] Login credentials prepared: {}", serde_json::to_string_pretty(&login_credentials).unwrap_or_default());
    
    // Send login request
    let client = reqwest::Client::new();
    println!("[FRIENDS DEBUG] Sending login request to https://api.resonite.com/userSessions");
    
    let response = client
        .post("https://api.resonite.com/userSessions")
        .header("Content-Type", "application/json")
        .header("UID", &uid)
        .json(&login_credentials)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("Login request failed: {}", e);
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg
        })?;
    
    let status = response.status();
    println!("[FRIENDS DEBUG] Login response status: {}", status);
    
    if status != 200 {
        let error_text = response.text().await.unwrap_or_default();
        let error_msg = format!("Login failed: {} - {}", status, error_text);
        println!("[FRIENDS DEBUG] {}", error_msg);
        return Err(error_msg);
    }
    
    let login_result: Value = response.json().await
        .map_err(|e| {
            let error_msg = format!("Failed to parse login response: {}", e);
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg
        })?;
    
    println!("[FRIENDS DEBUG] Login result: {}", serde_json::to_string_pretty(&login_result).unwrap_or_default());
    
    let session_token = login_result["entity"]["token"].as_str()
        .ok_or_else(|| {
            let error_msg = "Failed to get session token from response";
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg.to_string()
        })?;
    let user_id = login_result["entity"]["userId"].as_str()
        .ok_or_else(|| {
            let error_msg = "Failed to get user ID from response";
            println!("[FRIENDS DEBUG] {}", error_msg);
            error_msg.to_string()
        })?;
    
    println!("[FRIENDS DEBUG] Session token obtained: {}", session_token);
    println!("[FRIENDS DEBUG] User ID: {}", user_id);
    
    // Create shutdown channel for this connection
    let (shutdown_tx, shutdown_rx) = broadcast::channel(1);
    {
        let mut global_shutdown = SHUTDOWN_SENDER.lock().unwrap();
        *global_shutdown = Some(shutdown_tx);
    }
    
    // Start SignalR connection
    let auth_header = format!("res {}:{}", user_id, session_token);
    println!("[FRIENDS DEBUG] Starting SignalR connection with auth: {}", auth_header);
    
    if let Err(e) = start_signalr_connection(auth_header, shutdown_rx).await {
        println!("[FRIENDS DEBUG] SignalR connection failed: {}", e);
        return Err(format!("SignalR connection failed: {}", e));
    }
    
    Ok("Connected to Resonite friends API".to_string())
}

// Disconnect from Resonite friends API
async fn disconnect_resonite_friends() -> Result<String, String> {
    println!("[FRIENDS DEBUG] Disconnecting from Resonite API");
    
    // Send shutdown signal to all background tasks
    {
        let mut global_shutdown = SHUTDOWN_SENDER.lock().unwrap();
        if let Some(sender) = global_shutdown.take() {
            let _ = sender.send(());
            println!("[FRIENDS DEBUG] Shutdown signal sent to background tasks");
        }
    }
    
    Ok("Disconnected from Resonite friends API".to_string())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Resonite Friends Debug Tool");
    println!("==========================");
    
    // Read credentials from file first, fallback to interactive input
    let credentials = match std::fs::read_to_string("./credential") {
        Ok(content) => {
            let lines: Vec<&str> = content.trim().split('\n').collect();
            if lines.len() >= 2 {
                let identity = lines[0].split('=').nth(1).unwrap_or("").trim().to_string();
                let password = lines[1].split('=').nth(1).unwrap_or("").trim().to_string();
                println!("Using credentials from file: {}", identity);
                ResoniteCredentials { identity, password }
            } else {
                return Err("Invalid credential file format".into());
            }
        },
        Err(_) => {
            // 対話的にクレデンシャルを取得
            println!("Enter your Resonite credentials:");
            
            print!("Identity (Username/Email/UserID): ");
            use std::io::{self, Write};
            io::stdout().flush().unwrap();
            let mut identity = String::new();
            io::stdin().read_line(&mut identity).unwrap();
            let identity = identity.trim().to_string();
            
            print!("Password: ");
            io::stdout().flush().unwrap();
            let password = rpassword::read_password().unwrap();
            
            ResoniteCredentials { identity, password }
        }
    };
    
    println!("\nStarting connection...");
    
    // 接続を開始
    match connect_resonite_friends(credentials).await {
        Ok(msg) => {
            println!("✅ {}", msg);
            
            // Auto-stop after 15 seconds for testing, or Ctrl+C
            println!("\nPress Ctrl+C to disconnect and exit (auto-stop in 15 seconds)...");
            
            tokio::select! {
                _ = tokio::signal::ctrl_c() => {
                    println!("\nCtrl+C received");
                },
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(15)) => {
                    println!("\n[AUTO-STOP] Stopping after 15 seconds for testing...");
                }
            }
            
            println!("\nDisconnecting...");
            match disconnect_resonite_friends().await {
                Ok(msg) => println!("✅ {}", msg),
                Err(e) => println!("❌ {}", e),
            }
        },
        Err(e) => {
            println!("❌ Connection failed: {}", e);
        }
    }
    
    Ok(())
}