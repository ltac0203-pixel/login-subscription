# Login Subscription Template

React + PHP で構築された、ログイン認証およびサブスクリプション管理機能のテンプレートプロジェクトです。
決済プラットフォームとして [Fincode](https://www.fincode.jp/) を利用しています。

## 📋 機能一覧

### 認証機能
- ユーザー登録 (`/api/register`)
- ログイン (`/api/login`)
- ログアウト (`/api/logout`)
- セッション状態確認 (`/api/session-status`)

### サブスクリプション管理
- プラン一覧の取得 (`/api/subscription/plans`)
- 現在のサブスクリプション状況確認 (`/api/subscription`)
- クレジットカードの登録・一覧・削除
- サブスクリプションの契約・解約

## 🛠 技術スタック

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM

### Backend
- **Language**: PHP 8.x
- **Dependency Manager**: Composer
- **Database**: MySQL
- **Payment Gateway**: Fincode API

## 📂 ディレクトリ構成

```
.
├── backend/            # PHPバックエンド
│   ├── config/         # 設定ファイル
│   ├── controllers/    # APIコントローラー
│   ├── core/           # コアクラス (Router, DB接続, FincodeClient等)
│   └── index.php       # エントリーポイント
├── docs/               # ドキュメント・SQL定義
├── src/                # Reactフロントエンドソース
│   ├── api/            # API連携ロジック
│   ├── components/     # UIコンポーネント
│   ├── contexts/       # React Context (Auth等)
│   ├── hooks/          # カスタムフック
│   └── pages/          # ページコンポーネント
└── ...
```

## 🚀 環境構築手順

### 前提条件
- Node.js (v18以上)
- PHP (v8.0以上)
- Composer
- MySQL

### 1. データベースの準備

MySQLにデータベースを作成し、初期テーブルを作成します。

```bash
# MySQLにログインしてデータベース作成（例）
mysql -u root -p
CREATE DATABASE subscription_app;
exit;

# テーブル定義のインポート
mysql -u root -p subscription_app < docs/xs946644_tsunagi.sql
```

### 2. バックエンドのセットアップ

```bash
cd backend
composer install
```

プロジェクトルートに `.env` ファイルを作成し、以下の設定を記述します。

```ini
# Database Configuration
DB_HOST=localhost
DB_NAME=subscription_app
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Fincode Configuration (テスト環境キー等)
FINCODE_API_KEY=m_test_...
FINCODE_BASE_URL=https://api.test.fincode.jp
```

### 3. フロントエンドのセットアップ

```bash
# プロジェクトルートで
npm install
```

開発環境用の環境変数設定のため、`.env.development` (または `.env`) を作成し、PHPサーバーのアドレスを指定します。

```ini
VITE_API_BASE_URL=http://localhost:8000
```

### 4. アプリケーションの起動

**バックエンド (PHP)**

PHPのビルトインサーバーを使用する場合：

```bash
# プロジェクトルートで実行
php -S localhost:8000 -t backend
```

**フロントエンド (Vite)**

別のターミナルで実行：

```bash
npm run dev
```

ブラウザで `http://localhost:5173` (Viteの出力ポート) にアクセスしてください。

## 🔌 API エンドポイント仕様

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | 新規ユーザー登録 |
| POST | `/api/login` | ログイン |
| POST | `/api/logout` | ログアウト |
| GET | `/api/user` | ログインユーザー情報取得 |
| GET | `/api/session-status` | セッション有効性確認 |

### Subscription

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription` | 現在の契約状況取得 |
| POST | `/api/subscription` | サブスクリプション契約作成 |
| DELETE | `/api/subscription` | サブスクリプション解約 |
| GET | `/api/subscription/plans` | プラン一覧取得 |
| GET | `/api/subscription/cards` | 登録カード一覧取得 |
| POST | `/api/subscription/card` | 新規カード登録 |
| DELETE | `/api/subscription/cards/{cardId}` | カード削除 |

## ⚠️ 注意事項

- 本番環境にデプロイする際は、`backend/index.php` のCORS設定 (`$allowed_origins`) を適切なドメインに変更してください。
- データベースの接続情報は `.env` で管理し、Gitには含めないでください。

