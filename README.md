# 🤖 T1-Bridge-Auto-Bot

A powerful and user-friendly command-line interface (CLI) tool for automating cross-chain bridging across multiple EVM-compatible networks, including a custom T1 Devnet. Built with Node.js, `ethers.js`, and `blessed` for a rich terminal experience.

## ✨ Features

- **Interactive CLI Dashboard**: A terminal-based UI to monitor and control all operations without leaving your console.
- **Multi-Network Support**: Pre-configured for bridging between T1 Devnet, Sepolia, Arbitrum, and Base Sepolia.
- **Automated Bridging Cycles**: Set the number of bridging transactions and let the bot run automatically.
- **Real-Time Monitoring**: View live transaction logs, wallet balances, and operational status at a glance.
- **Secure Configuration**: Keeps your sensitive private key separate from the main codebase using a `.env` file.
- **Intelligent Delays**: Implements randomized delays between cycles to mimic human behavior.

---

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v16.x or later)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

---

## 🚀 Getting Started

Follow these steps to get the bot up and running on your local machine.

### 1. Clone the Repository

Clone this project to your local machine using Git:

```bash
git clone https://github.com/BigFreaky/T1-Bridge-Auto-Bot.git
cd T1-Bridge-Auto-Bot
```

### 2. Install Dependencies

Install all the required npm packages by running:

```bash
npm install
```

### 3. Configure Your Environment

Open the `.env` file and add your wallet's private key. This is the **only value** you need to add.

```bash
nano .env
```

> **Security Note**: Your private key grants full control over your wallet. **Never** share it with anyone or commit it to a public repository. The `.gitignore` file is configured to prevent this file from being tracked by Git.

---

## 🖥️ Usage

Once the installation and configuration are complete, you can start the bot with the following command:

```bash
npm start
```

This will launch the interactive terminal dashboard. From here, you can use the keyboard to navigate menus and start bridging operations.

### Controls

- **`M`**: Open the main menu.
- **`S`**: Stop the current running operation (will finish the current step first).
- **`C`**: Clear all logs from the transaction panel.
- **`Q` / `Esc` / `Ctrl+C`**: Quit the application.
- **Arrow Keys**: Navigate through menu items.
- **Enter**: Select a menu item.

---

## ⚠️ Disclaimer

This tool is provided for educational and experimental purposes. Automating cryptocurrency transactions carries inherent risks, including the potential for financial loss due to bugs, network issues, or improper configuration. Use this software at your own risk and preferably with a wallet that has limited funds. The creators are not responsible for any losses incurred.
