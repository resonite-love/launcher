import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  X, 
  Check,
  ExternalLink 
} from 'lucide-react';

interface ModRiskWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
}

function ModRiskWarningModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "MODローダーのインストール" 
}: ModRiskWarningModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-dark-900 border border-orange-500/30 rounded-xl p-6 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
                <h3 className="text-xl font-bold text-white">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 警告内容 */}
            <div className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-orange-400 font-semibold mb-2">重要な警告</h4>
                    <p className="text-orange-200 text-sm">
                      MODローダーをインストールすることで、サードパーティのコードがResoniteで実行されることになります。
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-300">
                <h5 className="font-semibold text-white">以下のリスクを理解してください：</h5>
                
                <ul className="space-y-2 pl-4">
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>MODによりゲームが不安定になる可能性があります</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>個人情報やアカウント情報が悪意のあるMODに盗まれる可能性があります</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>ゲームアップデート時にMODが動作しなくなる可能性があります</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <ExternalLink className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-blue-400 font-semibold mb-2">推奨事項</h4>
                    <ul className="text-blue-200 text-sm space-y-1">
                      <li>• 信頼できるソースからのMODのみをインストールしてください</li>
                      <li>• MODの使用は自己責任で行ってください</li>
                      <li>• 定期的にプロファイルのバックアップを取ってください</li>
                      <li>• 問題が発生した場合はMODローダーを削除してください</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-200 text-sm text-center font-medium">
                  上記のリスクを理解し、自己責任でMODローダーを使用することに同意しますか？
                </p>
              </div>
            </div>

            {/* ボタン */}
            <div className="flex space-x-3 mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-secondary flex-1"
                onClick={onClose}
              >
                キャンセル
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary flex-1 flex items-center justify-center space-x-2 bg-orange-600 hover:bg-orange-500"
                onClick={onConfirm}
              >
                <Check className="w-4 h-4" />
                <span>理解してインストール</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ModRiskWarningModal;