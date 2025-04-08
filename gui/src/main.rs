use eframe::egui;
use egui::{CentralPanel, TopBottomPanel, Context, RichText, Ui, FontFamily};
use resonite_tools_lib::{
    install::{ResoniteInstall, ResoniteInstallManager},
    profile::{Profile, ProfileManager},
    steamcmd::SteamCmd,
    utils,
};
use std::path::PathBuf;

fn main() -> Result<(), eframe::Error> {
    // オプション：ネイティブスタイル
    let options = eframe::NativeOptions {
        initial_window_size: Some(egui::vec2(800.0, 600.0)),
        ..Default::default()
    };

    // アプリケーションを起動
    eframe::run_native(
        "Resonite Tools",
        options,
        Box::new(|cc| {
            // 日本語フォントの設定
            setup_custom_fonts(&cc.egui_ctx);
            
            Box::new(ResoniteToolsApp::new(cc))
        }),
    )
}

// アプリケーションの状態
struct ResoniteToolsApp {
    // ライブラリのインスタンス
    steam_cmd: Option<SteamCmd>,
    profile_manager: Option<ProfileManager>,
    install_manager: Option<ResoniteInstallManager>,
    
    // UI状態
    current_tab: Tab,
    profiles: Vec<Profile>,
    exe_dir: Option<PathBuf>,
    
    // インストール関連
    branch: String,
    install_path: String,
    steam_username: String,
    steam_password: String,
    steam_auth_code: String,
    
    // プロファイル作成/編集
    new_profile_name: String,
    new_profile_description: String,
    selected_profile_index: Option<usize>,
    edit_mode: bool,
    
    // アップデート確認結果
    update_available: Option<bool>,
    
    // エラーメッセージ
    error_message: Option<String>,
    success_message: Option<String>,
}

#[derive(PartialEq)]
enum Tab {
    Profiles,
    Installation,
    Launch,
}

// 日本語フォントの設定関数
fn setup_custom_fonts(ctx: &egui::Context) {
    // フォント設定
    let mut fonts = egui::FontDefinitions::default();
    
    // プロポーショナルフォントファミリの優先順位を設定
    // "Meiryo UI"、"Yu Gothic UI"、"MS Gothic"などの日本語フォントが
    // システムにあれば自動的に使用される

    fonts.font_data.insert(
        "noto_sans_jp".to_owned(),
        egui::FontData::from_static(include_bytes!("../fonts/NotoSansJP-Regular.ttf")).into(),
    );

    // フォントファミリーに追加
    fonts
        .families
        .entry(FontFamily::Proportional)
        .or_default()
        .insert(0, "noto_sans_jp".to_owned()); // 一番優先度高く追加

    // モノスペースフォントにも日本語フォントを追加
    fonts
        .families
        .entry(FontFamily::Monospace)
        .or_default()
        .push("noto_sans_jp".to_owned());


    // デフォルトフォントを最大サイズに設定して、CJK文字をよりよくサポートする
    ctx.set_pixels_per_point(1.5);
    
    // フォントデータとして埋め込むことはしません。システムフォントを使用
    
    // フォント設定を適用
    ctx.set_fonts(fonts);
}

impl ResoniteToolsApp {
    fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        // 初期化
        let mut app = Self {
            steam_cmd: None,
            profile_manager: None,
            install_manager: None,
            current_tab: Tab::Profiles,
            profiles: Vec::new(),
            exe_dir: None,
            branch: "release".to_string(),
            install_path: "".to_string(),
            steam_username: "".to_string(),
            steam_password: "".to_string(),
            steam_auth_code: "".to_string(),
            new_profile_name: "".to_string(),
            new_profile_description: "".to_string(),
            selected_profile_index: None,
            edit_mode: false,
            update_available: None,
            error_message: None,
            success_message: None,
        };
        
        // 初期化処理を試行
        app.initialize();
        
        app
    }
    
    fn initialize(&mut self) {
        // 実行可能ファイルのディレクトリを取得
        match utils::get_executable_directory() {
            Ok(dir) => {
                self.exe_dir = Some(dir.clone());
                
                // SteamCMDの初期化
                self.steam_cmd = Some(SteamCmd::with_default_path(&dir));
                
                // プロファイルマネージャの初期化
                self.profile_manager = Some(ProfileManager::new(&dir));
                
                // インストールマネージャの初期化
                self.install_manager = Some(ResoniteInstallManager::new(&dir));
                
                // プロファイル一覧を取得
                self.refresh_profiles();
                
                // インストールパスの初期値を設定
                if let Some(install_manager) = &self.install_manager {
                    self.install_path = install_manager.determine_install_path(None, &self.branch);
                }
            }
            Err(e) => {
                self.error_message = Some(format!("初期化に失敗しました: {}", e));
            }
        }
    }
    
    fn refresh_profiles(&mut self) {
        if let Some(profile_manager) = &self.profile_manager {
            match profile_manager.list_profiles() {
                Ok(profiles) => {
                    self.profiles = profiles;
                }
                Err(e) => {
                    self.error_message = Some(format!("プロファイルの取得に失敗しました: {}", e));
                }
            }
        }
    }
}

impl eframe::App for ResoniteToolsApp {
    fn update(&mut self, ctx: &Context, _frame: &mut eframe::Frame) {
        // トップパネル（ヘッダー）
        TopBottomPanel::top("header").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("Resonite Tools");
                ui.add_space(10.0);
                
                if ui.selectable_label(self.current_tab == Tab::Profiles, "プロファイル").clicked() {
                    self.current_tab = Tab::Profiles;
                }
                if ui.selectable_label(self.current_tab == Tab::Installation, "インストール").clicked() {
                    self.current_tab = Tab::Installation;
                }
                if ui.selectable_label(self.current_tab == Tab::Launch, "起動").clicked() {
                    self.current_tab = Tab::Launch;
                }
            });
        });
        
        // ボトムパネル（フッター）
        TopBottomPanel::bottom("footer").show(ctx, |ui| {
            ui.horizontal(|ui| {
                if let Some(exe_dir) = &self.exe_dir {
                    ui.label(format!("実行ディレクトリ: {}", exe_dir.display()));
                } else {
                    ui.label("実行ディレクトリ: 不明");
                }
            });
        });
        
        // メインコンテンツ
        CentralPanel::default().show(ctx, |ui| {
            // エラーメッセージがある場合は表示
            if let Some(error) = &self.error_message {
                ui.label(RichText::new(error).color(egui::Color32::RED));
                if ui.button("閉じる").clicked() {
                    self.error_message = None;
                }
                ui.separator();
            }
            
            // 現在のタブに応じたコンテンツを表示
            match self.current_tab {
                Tab::Profiles => self.render_profiles_tab(ui),
                Tab::Installation => self.render_installation_tab(ui),
                Tab::Launch => self.render_launch_tab(ui),
            }
        });
    }
}

// 各タブのUI実装
impl ResoniteToolsApp {
    fn render_profiles_tab(&mut self, ui: &mut Ui) {
        ui.heading("プロファイル管理");
        
        // 成功メッセージがあれば表示
        if let Some(msg) = &self.success_message {
            ui.label(RichText::new(msg).color(egui::Color32::GREEN));
            if ui.button("閉じる").clicked() {
                self.success_message = None;
            }
            ui.separator();
        }
        
        // 新規プロファイル作成フォーム
        ui.group(|ui| {
            ui.collapsing("新規プロファイルを作成", |ui| {
                ui.horizontal(|ui| {
                    ui.label("名前:");
                    ui.text_edit_singleline(&mut self.new_profile_name);
                });
                
                ui.horizontal(|ui| {
                    ui.label("説明:");
                    ui.text_edit_singleline(&mut self.new_profile_description);
                });
                
                if ui.button("プロファイルを作成").clicked() && !self.new_profile_name.is_empty() {
                    self.create_profile();
                }
            });
        });
        
        ui.separator();
        
        // プロファイル一覧
        ui.horizontal(|ui| {
            ui.heading("プロファイル一覧");
            if ui.button("更新").clicked() {
                self.refresh_profiles();
            }
        });
        
        if self.profiles.is_empty() {
            ui.label("プロファイルがありません。新規作成してください。");
        } else {
            // プロファイル一覧をテーブルで表示
            egui::ScrollArea::vertical().show(ui, |ui| {
                egui::Grid::new("profiles_grid")
                    .num_columns(4)
                    .striped(true)
                    .spacing([10.0, 5.0])
                    .show(ui, |ui| {
                        ui.label("名前");
                        ui.label("説明");
                        ui.label("操作");
                        ui.label("");
                        ui.end_row();
                        
                        // プロファイル情報を先に取得しておく
                        let profile_data: Vec<(usize, String, String)> = self.profiles
                            .iter()
                            .enumerate()
                            .map(|(i, profile)| (i, profile.name.clone(), profile.description.clone()))
                            .collect();
                        
                        for (i, name, description) in profile_data {
                            ui.label(&name);
                            ui.label(if !description.is_empty() { &description } else { "-" });
                            
                            ui.horizontal(|ui| {
                                if ui.button("編集").clicked() {
                                    self.edit_profile(i);
                                }
                                
                                if ui.button("起動").clicked() {
                                    self.launch_profile(i);
                                }
                            });
                            
                            ui.label(""); // 空のセルを追加してレイアウトを調整
                            ui.end_row();
                        }
                    });
            });
        }
    }
    
    // 新規プロファイルを作成する
    fn create_profile(&mut self) {
        if let Some(profile_manager) = &self.profile_manager {
            match profile_manager.create_profile(&self.new_profile_name) {
                Ok(mut profile) => {
                    // 説明を設定
                    profile.description = self.new_profile_description.clone();
                    
                    // プロファイルディレクトリのパスを取得
                    let profiles_dir = profile_manager.get_profiles_dir();
                    let profile_dir = profiles_dir.join(&self.new_profile_name);
                    
                    // 更新したプロファイルを保存
                    if let Err(e) = profile.save(&profile_dir) {
                        self.error_message = Some(format!("プロファイルの保存に失敗しました: {}", e));
                    } else {
                        self.success_message = Some(format!("プロファイル '{}' を作成しました", self.new_profile_name));
                        self.new_profile_name = "".to_string();
                        self.new_profile_description = "".to_string();
                        self.refresh_profiles();
                    }
                }
                Err(e) => {
                    self.error_message = Some(format!("プロファイルの作成に失敗しました: {}", e));
                }
            }
        }
    }
    
    // プロファイル編集モードを開始
    fn edit_profile(&mut self, index: usize) {
        if index < self.profiles.len() {
            self.selected_profile_index = Some(index);
            self.new_profile_name = self.profiles[index].name.clone();
            self.new_profile_description = self.profiles[index].description.clone();
            self.edit_mode = true;
            
            self.current_tab = Tab::Profiles;
        }
    }
    
    // 指定されたプロファイルでResoniteを起動
    fn launch_profile(&mut self, index: usize) {
        if index >= self.profiles.len() {
            return;
        }
        
        let profile_name = self.profiles[index].name.clone();
        
        if let (Some(install_manager), Some(profile_manager)) = (&self.install_manager, &self.profile_manager) {
            // プロファイルディレクトリのパスを取得
            let profiles_dir = profile_manager.get_profiles_dir();
            let profile_dir = profiles_dir.join(&profile_name);
            
            // Resoniteを起動
            match install_manager.launch_with_profile(&self.branch, &profile_dir) {
                Ok(()) => {
                    self.success_message = Some(format!("Resoniteをプロファイル '{}' で起動しました", profile_name));
                }
                Err(e) => {
                    self.error_message = Some(format!("起動に失敗しました: {}", e));
                }
            }
        }
    }
    
    fn render_installation_tab(&mut self, ui: &mut Ui) {
        ui.heading("Resoniteのインストールと更新");
        
        // 成功メッセージがあれば表示
        if let Some(msg) = &self.success_message {
            ui.label(RichText::new(msg).color(egui::Color32::GREEN));
            if ui.button("閉じる").clicked() {
                self.success_message = None;
            }
            ui.separator();
        }
        
        // 更新確認結果があれば表示
        if let Some(update_available) = self.update_available {
            if update_available {
                ui.label(RichText::new("更新が利用可能です。").color(egui::Color32::YELLOW));
            } else {
                ui.label(RichText::new("Resoniteは最新版です。").color(egui::Color32::GREEN));
            }
            if ui.button("確認を閉じる").clicked() {
                self.update_available = None;
            }
            ui.separator();
        }
        
        ui.horizontal(|ui| {
            ui.label("ブランチ:");
            let previous_branch = self.branch.clone();
            ui.radio_value(&mut self.branch, "release".to_string(), "リリース版");
            ui.radio_value(&mut self.branch, "prerelease".to_string(), "プレリリース版");
            
            // ブランチが変更された場合、インストールパスを更新
            if previous_branch != self.branch {
                if let Some(install_manager) = &self.install_manager {
                    self.install_path = install_manager.determine_install_path(None, &self.branch);
                }
            }
        });
        
        ui.horizontal(|ui| {
            ui.label("インストール先:");
            ui.text_edit_singleline(&mut self.install_path);
        });
        
        ui.collapsing("Steam認証情報 (オプション)", |ui| {
            ui.horizontal(|ui| {
                ui.label("ユーザー名:");
                ui.text_edit_singleline(&mut self.steam_username);
            });
            
            ui.horizontal(|ui| {
                ui.label("パスワード:");
                ui.add(egui::TextEdit::singleline(&mut self.steam_password).password(true));
            });
            
            ui.horizontal(|ui| {
                ui.label("認証コード:");
                ui.text_edit_singleline(&mut self.steam_auth_code);
            });
        });
        
        ui.separator();
        
        ui.horizontal(|ui| {
            if ui.button("インストール").clicked() {
                self.install_resonite();
            }
            
            if ui.button("更新").clicked() {
                self.update_resonite();
            }
            
            if ui.button("更新確認").clicked() {
                self.check_resonite_updates();
            }
        });
    }
    
    // Resoniteをインストールする
    fn install_resonite(&mut self) {
        if let Some(steam_cmd) = &self.steam_cmd {
            // インストール情報を作成
            let install = ResoniteInstall::new(
                self.install_path.clone(),
                self.branch.clone(),
                if self.steam_username.is_empty() { None } else { Some(self.steam_username.clone()) },
                if self.steam_password.is_empty() { None } else { Some(self.steam_password.clone()) },
                if self.steam_auth_code.is_empty() { None } else { Some(self.steam_auth_code.clone()) },
            );
            
            // インストールを実行
            match install.install(steam_cmd) {
                Ok(()) => {
                    self.success_message = Some(format!("Resonite {} ブランチのインストールが完了しました", self.branch));
                },
                Err(e) => {
                    self.error_message = Some(format!("インストールに失敗しました: {}", e));
                }
            }
        }
    }
    
    // Resoniteを更新する
    fn update_resonite(&mut self) {
        if let Some(steam_cmd) = &self.steam_cmd {
            // インストール情報を作成
            let install = ResoniteInstall::new(
                self.install_path.clone(),
                self.branch.clone(),
                if self.steam_username.is_empty() { None } else { Some(self.steam_username.clone()) },
                if self.steam_password.is_empty() { None } else { Some(self.steam_password.clone()) },
                if self.steam_auth_code.is_empty() { None } else { Some(self.steam_auth_code.clone()) },
            );
            
            // 更新を実行
            match install.update(steam_cmd) {
                Ok(()) => {
                    self.success_message = Some(format!("Resonite {} ブランチの更新が完了しました", self.branch));
                },
                Err(e) => {
                    self.error_message = Some(format!("更新に失敗しました: {}", e));
                }
            }
        }
    }
    
    // Resoniteの更新を確認する
    fn check_resonite_updates(&mut self) {
        if let Some(steam_cmd) = &self.steam_cmd {
            // インストール情報を作成
            let install = ResoniteInstall::new(
                self.install_path.clone(),
                self.branch.clone(),
                if self.steam_username.is_empty() { None } else { Some(self.steam_username.clone()) },
                if self.steam_password.is_empty() { None } else { Some(self.steam_password.clone()) },
                if self.steam_auth_code.is_empty() { None } else { Some(self.steam_auth_code.clone()) },
            );
            
            // 更新確認を実行
            match install.check_updates(steam_cmd) {
                Ok(available) => {
                    self.update_available = Some(available);
                },
                Err(e) => {
                    self.error_message = Some(format!("更新確認に失敗しました: {}", e));
                }
            }
        }
    }
    
    fn render_launch_tab(&mut self, ui: &mut Ui) {
        ui.heading("Resoniteの起動");
        
        // 成功メッセージがあれば表示
        if let Some(msg) = &self.success_message {
            ui.label(RichText::new(msg).color(egui::Color32::GREEN));
            if ui.button("閉じる").clicked() {
                self.success_message = None;
            }
            ui.separator();
        }
        
        ui.horizontal(|ui| {
            ui.label("ブランチ:");
            ui.radio_value(&mut self.branch, "release".to_string(), "リリース版");
            ui.radio_value(&mut self.branch, "prerelease".to_string(), "プレリリース版");
        });
        
        ui.separator();
        
        ui.heading("起動するプロファイルを選択:");
        
        if self.profiles.is_empty() {
            ui.label("プロファイルがありません。プロファイルタブで作成してください。");
            
            if ui.button("プロファイルタブへ移動").clicked() {
                self.current_tab = Tab::Profiles;
            }
        } else {
            // プロファイル一覧をテーブルで表示
            egui::ScrollArea::vertical().show(ui, |ui| {
                egui::Grid::new("launch_profiles_grid")
                    .num_columns(3)
                    .striped(true)
                    .spacing([10.0, 5.0])
                    .show(ui, |ui| {
                        ui.label("名前");
                        ui.label("説明");
                        ui.label("操作");
                        ui.end_row();
                        
                        // プロファイル情報を先に取得しておく
                        let profile_data: Vec<(usize, String, String)> = self.profiles
                            .iter()
                            .enumerate()
                            .map(|(i, profile)| (i, profile.name.clone(), profile.description.clone()))
                            .collect();
                        
                        for (i, name, description) in profile_data {
                            ui.label(&name);
                            ui.label(if !description.is_empty() { &description } else { "-" });
                            
                            if ui.button(format!("{} ブランチで起動", self.branch)).clicked() {
                                self.launch_profile(i);
                            }
                            
                            ui.end_row();
                        }
                    });
            });
            
            ui.separator();
            
            if ui.button("プロファイル一覧を更新").clicked() {
                self.refresh_profiles();
            }
        }
    }
}
