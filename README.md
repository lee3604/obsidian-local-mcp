# Obsidian MCP Server Plugin - User Manual
**Turn your Obsidian Vault into a powerful Model Context Protocol (MCP) server.**

This plugin allows AI tools like **Claude Desktop**, **Cursor** (via Antigravity), and others to **directly read, search, and write** to your local Obsidian notes. It works completely locally (localhost), ensuring your data remains private and secure.

---

## 🚀 Installation & Setup

1.  **Install the Plugin:**
    *   Currently, this plugin needs to be installed manually or via BRAT until it's available in the Community Plugins list.
2.  **Enable the Plugin:**
    *   Go to **Settings** > **Community Plugins** and toggle it ON.
3.  **Start the Server:**
    *   The MCP server starts automatically by default.
    *   You can verify its status in the **Status Bar** (bottom-right: `MCP: On`).
    *   Click the ribbon icon (server icon) to open the **Dashboard**.

---

## 🔗 Connection Guides

### 1. Connecting to Claude Desktop App

The Claude Desktop App supports MCP natively. You need to configure a local JSON file to tell Claude where to find your Obsidian server.

1.  Open the **Obsidian MCP Dashboard** (Ribbon Icon).
2.  Look for the **"Connection Helper"** section.
3.  Click the **"Copy Config to Clipboard"** button.
4.  Open your Claude config file:
    *   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
    *   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
5.  Paste the configuration inside the `mcpServers` object. It should look like this:

```json
{
  "mcpServers": {
    "obsidian": {
      "url": "http://127.0.0.1:51234/mcp",
      "type": "sse"
    }
  }
}
```

6.  Restart Claude Desktop. You should now see a 🔌 icon indicating the connection.

### 2. Connecting to Antigravity (Cursor)

Antigravity (and Cursor's upcoming features) can also interact with local MCP servers.

1.  Ensure the Obsidian MCP plugin is running.
2.  Locate your Antigravity or Cursor MCP configuration file (`mcp.json` or similar in your settings profile).
3.  Add the same server configuration as above:

```json
"my-obsidian-vault": {
    "url": "http://127.0.0.1:51234/mcp",
    "type": "sse"
}
```

4.  **Note:** Make sure the port (`51234` or similar) matches what is shown in your Obsidian Dashboard.

---

## ✨ New Features

*   **Connection Helper:**
    *   In the Dashboard, you can copy the exact configuration JSON needed for Claude or Antigravity with one click.
*   **Self-Test / Diagnostics:**
    *   Troubleshoot connection issues by running a local self-test directly from the Dashboard.
*   **Activity Indicator:**
    *   The "MCP: On" status bar item pulses (blinks) whenever an AI tool reads or accesses your notes, so you always know when your data is being used.
*   **Folder Restriction:**
    *   Limit AI access to specific folders (e.g., only "Public"). Configure this in the Obsidian Settings tab.

---

## 🛡️ Tips & Troubleshooting

*   **Write Permissions:** By default, the plugin is in **Read-only** mode. If you want AI to write notes:
    *   Go to **Settings** > **Obsidian MCP Server**.
    *   Change **Write Mode** to **"Confirm each write"**.
*   **Connection Issues:** Use the **"Run Self-Test"** button in the Dashboard to verify that the server is responding correctly.

---

# 옵시디언 MCP 서버 플러그인 - 사용자 설명서
**옵시디언 볼트를 강력한 MCP(Model Context Protocol) 서버로 변신시키세요.**

이 플러그인은 **Claude Desktop**, **Cursor**(Antigravity), 그리고 다른 AI 도구들이 여러분의 로컬 옵시디언 노트를 **직접 읽고, 검색하고, 작성**할 수 있게 해줍니다. 모든 통신은 로컬(localhost)에서 이루어지므로, 여러분의 데이터는 안전하게 보호됩니다.

---

## ✨ 주요 기능 (New)

*   **연결 도우미 (Connection Helper):**
    *   Claude나 Antigravity 연동에 필요한 복잡한 설정 코드를 대시보드에서 클릭 한 번으로 복사할 수 있습니다.
*   **자가 진단 (Self-Test):**
    *   연결이 안 될 때, 이게 서버 문제인지 내 설정 문제인지 대시보드에서 바로 테스트해볼 수 있습니다.
*   **활동 알림 (Activity Indicator):**
    *   AI가 내 노트를 읽거나 검색할 때마다 우측 하단 상태 표시줄이 깜빡거립니다. 내 데이터가 사용되는 순간을 직관적으로 알 수 있습니다.
*   **폴더 제한 (Folder Restriction):**
    *   AI가 내 모든 노트를 보지 못하게 하려면, 특정 폴더(예: "공부")만 허용하도록 설정할 수 있습니다. 설정 탭에서 지정하세요.

---

## 🚀 설치 및 시작하기

1.  **플러그인 설치:**
    *   커뮤니티 플러그인 목록에 등록되기 전까지는 수동 설치 혹은 BRAT을 통해 설치해주세요.
2.  **플러그인 활성화:**
    *   **설정(Settings)** > **커뮤니티 플러그인(Community Plugins)**에서 활성화 스위치를 켭니다.
3.  **서버 시작:**
    *   기본적으로 Obsidian 실행 시 서버가 자동으로 시작됩니다.
    *   하단 상태 표시줄에서 **`MCP: On`** 문구를 확인하세요.
    *   좌측 리본 메뉴의 서버 아이콘을 클릭하여 **대시보드**를 열 수 있습니다.

---

## 🔗 연동 가이드

### 1. Claude(클로드) 데스크탑 앱 연동

Claude 데스크탑 앱은 MCP를 기본적으로 지원합니다. 설정 파일에 이 서버 정보를 추가하면 됩니다.

1.  Obsidian에서 **MCP 대시보드**를 엽니다.
2.  **"Connection Helper"** 섹션을 찾습니다.
3.  **"Copy Config to Clipboard"** 버튼을 눌러 설정을 복사합니다.
4.  Claude 설정 파일을 엽니다:
    *   **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
    *   **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
5.  `mcpServers` 항목 안에 복사한 내용을 붙여넣으세요. 대략 아래와 같습니다:

```json
{
  "mcpServers": {
    "obsidian": {
      "url": "http://127.0.0.1:51234/mcp",
      "type": "sse"
    }
  }
}
```

6.  Claude 앱을 재시작하면 연결 아이콘(🔌)이 뜨는 것을 확인할 수 있습니다.

### 2. Antigravity (Cursor) 연동

Antigravity나 Cursor를 통해서도 로컬 Obsidian과 대화할 수 있습니다.

1.  Obsidian MCP 서버가 켜져 있는지 확인합니다.
2.  사용 중인 Antigravity 혹은 Cursor의 MCP 설정 파일(`mcp.json`)을 찾습니다.
3.  아래와 같이 서버 정보를 추가합니다:

```json
"my-obsidian-vault": {
    "url": "http://127.0.0.1:51234/mcp",
    "type": "sse"
}
```

4.  **주의:** 포트 번호(`51234` 등)가 Obsidian 대시보드에 표시된 숫자와 일치하는지 꼭 확인하세요.

---

## 🛡️ 팁 & 문제 해결

*   **쓰기 권한 (Write Permissions):** 기본적으로 **읽기 전용(Read-only)** 모드로 설정되어 있습니다. AI가 노트를 쓰게 하려면:
    *   **설정** > **Obsidian MCP Server**로 이동하세요.
    *   **Write Mode**를 **"Confirm each write"** (매번 확인) 등으로 변경하세요.
*   **연결 문제:** 대시보드에 있는 **"Run Self-Test"** (자가 진단) 버튼을 통해 서버가 정상 작동 중인지 자체 테스트해볼 수 있습니다.
