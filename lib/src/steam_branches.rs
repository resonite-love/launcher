use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

/// Steam app metadata served by the public, unauthenticated SteamCMD API.
const APP_INFO_URL: &str = "https://api.steamcmd.net/v1/info/2519830";

#[derive(Debug, Serialize, PartialEq)]
pub struct SteamBranch {
    pub name: String,
    pub description: String,
    pub password_required: bool,
}

pub async fn fetch_game_branches() -> Result<Vec<SteamBranch>, String> {
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?
        .get(APP_INFO_URL)
        .send()
        .await
        .and_then(|response| response.error_for_status())
        .map_err(|e| format!("Failed to fetch Steam branches: {e}"))?;
    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid Steam app metadata: {e}"))?;
    parse_branches(&data)
}

fn parse_branches(data: &Value) -> Result<Vec<SteamBranch>, String> {
    if data["status"] != "success" {
        return Err("SteamCMD API did not return successful app metadata".into());
    }
    let branches = data
        .pointer("/data/2519830/depots/branches")
        .and_then(Value::as_object)
        .ok_or("Steam app metadata does not contain branches")?;
    let mut result = Vec::new();
    for (name, info) in branches {
        crate::utils::validate_branch(name).map_err(|e| e.to_string())?;
        if !info.is_object() {
            return Err(format!("Invalid metadata for Steam branch '{name}'"));
        }
        let password_required = match info.get("pwdrequired") {
            None | Some(Value::Null) => false,
            Some(Value::String(value)) => value != "0" && !value.is_empty(),
            Some(Value::Bool(value)) => *value,
            Some(Value::Number(value)) => value.as_u64() != Some(0),
            _ => {
                return Err(format!(
                    "Invalid password requirement for Steam branch '{name}'"
                ))
            }
        };
        result.push(SteamBranch {
            name: name.clone(),
            description: info["description"].as_str().unwrap_or_default().to_string(),
            password_required,
        });
    }
    if result.is_empty() {
        return Err("Steam app metadata contains no branches".into());
    }
    // Preserve Steam's exact names: public and release are distinct branches.
    result.sort_by(|a, b| {
        let rank = |name: &str| match name {
            "release" => 0,
            "public" => 1,
            "prerelease" => 2,
            _ => 3,
        };
        rank(&a.name).cmp(&rank(&b.name)).then(a.name.cmp(&b.name))
    });
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_dynamic_branches_without_merging_public_and_release() {
        let data = json!({"status": "success", "data": {"2519830": {"depots": {"branches": {
            "alpha-prime": {"description": "Alpha"}, "pre-splittening": {},
            "release": {}, "public": {}, "prerelease": {},
            "private": {"pwdrequired": "1"}, "unlocked": {"pwdrequired": "0"},
            "private-numeric": {"pwdrequired": 1}, "private-boolean": {"pwdrequired": true}
        }}}}});
        let branches = parse_branches(&data).unwrap();
        assert_eq!(
            branches
                .iter()
                .take(3)
                .map(|b| b.name.as_str())
                .collect::<Vec<_>>(),
            vec!["release", "public", "prerelease"]
        );
        assert_eq!(
            branches
                .iter()
                .find(|b| b.name == "alpha-prime")
                .unwrap()
                .description,
            "Alpha"
        );
        assert!(branches
            .iter()
            .filter(|b| b.name.starts_with("private"))
            .all(|b| b.password_required));
        assert!(
            !branches
                .iter()
                .find(|b| b.name == "unlocked")
                .unwrap()
                .password_required
        );
    }

    #[test]
    fn rejects_errors_missing_empty_and_malformed_branches() {
        for data in [
            json!({"status": "error"}),
            json!({"status": "success"}),
            json!({"status": "success", "data": {"2519830": {"depots": {"branches": {}}}}}),
            json!({"status": "success", "data": {"2519830": {"depots": {"branches": {"beta": null}}}}}),
        ] {
            assert!(parse_branches(&data).is_err());
        }
    }

    #[tokio::test]
    #[ignore = "requires the public SteamCMD API"]
    async fn fetch_live_branches() {
        let branches = fetch_game_branches().await.unwrap();
        assert!(branches.iter().any(|branch| branch.name == "public"));
        println!(
            "Steam branches: {:?}",
            branches.iter().map(|b| &b.name).collect::<Vec<_>>()
        );
    }
}
