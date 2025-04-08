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
    
    // エラーメッセージ
    error_message: Option<String>,
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
            error_message: None,
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
        
        ui.horizontal(|ui| {
            if ui.button("プロファイル一覧を更新").clicked() {
                self.refresh_profiles();
            }
            
            if ui.button("新規プロファイルを作成").clicked() {
                // TODO: 新規プロファイル作成ダイアログ
                // 現在は未実装
            }
        });
        
        ui.separator();
        
        if self.profiles.is_empty() {
            ui.label("プロファイルがありません。新規作成してください。");
        } else {
            ui.label(format!("プロファイル数: {}", self.profiles.len()));
            
            for profile in &self.profiles {
                ui.horizontal(|ui| {
                    ui.label(&profile.name);
                    if !profile.description.is_empty() {
                        ui.label(&profile.description);
                    }
                    
                    if ui.button("編集").clicked() {
                        // TODO: プロファイル編集ダイアログ
                        // 現在は未実装
                    }
                    
                    if ui.button("起動").clicked() {
                        // TODO: Resoniteの起動機能
                        // 現在は未実装
                    }
                });
            }
        }
    }
    
    fn render_installation_tab(&mut self, ui: &mut Ui) {
        ui.heading("Resoniteのインストールと更新");
        
        ui.horizontal(|ui| {
            ui.label("ブランチ:");
            ui.radio_value(&mut self.branch, "release".to_string(), "リリース版");
            ui.radio_value(&mut self.branch, "prerelease".to_string(), "プレリリース版");
        });
        
        ui.horizontal(|ui| {
            ui.label("インストール先:");
            ui.text_edit_singleline(&mut self.install_path);
            if ui.button("参照").clicked() {
                // TODO: ディレクトリ選択ダイアログ
                // 現在は未実装
            }
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
                // TODO: インストール機能
                // 現在は未実装
            }
            
            if ui.button("更新").clicked() {
                // TODO: 更新機能
                // 現在は未実装
            }
            
            if ui.button("更新確認").clicked() {
                // TODO: 更新確認機能
                // 現在は未実装
            }
        });
    }
    
    fn render_launch_tab(&mut self, ui: &mut Ui) {
        ui.heading("Resoniteの起動");
        
        ui.horizontal(|ui| {
            ui.label("ブランチ:");
            ui.radio_value(&mut self.branch, "release".to_string(), "リリース版");
            ui.radio_value(&mut self.branch, "prerelease".to_string(), "プレリリース版");
        });
        
        ui.separator();
        
        ui.label("起動するプロファイルを選択:");
        
        if self.profiles.is_empty() {
            ui.label("プロファイルがありません。プロファイルタブで作成してください。");
        } else {
            for profile in &self.profiles {
                ui.horizontal(|ui| {
                    ui.label(&profile.name);
                    if !profile.description.is_empty() {
                        ui.label(&profile.description);
                    }
                    
                    if ui.button("起動").clicked() {
                        // TODO: Resoniteの起動機能
                        // 現在は未実装
                    }
                });
            }
        }
    }
}
