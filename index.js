import "dotenv/config";
import blessed from "blessed";
import { ethers } from "ethers";
import chalk from 'chalk';

const STYLE = {
  fg: "white",
  bg: "black",
  border: "green",
  selected: {
    bg: "green",
    fg: "black",
  },
  error: "red",
  success: "green",
  warning: "yellow",
  info: "cyan",
  bridge: "magenta",
};

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error(chalk.red("Fatal Error: PRIVATE_KEY is not set in your .env file."));
  process.exit(1);
}

const requiredEnvVars = [
    'RPC_URL_SEPOLIA',
    'RPC_URL_T1',
    'T1_CHAIN_ID',
    'T1_L1_BRIDGE_CONTRACT',
    'T1_L2_BRIDGE_CONTRACT'
];

for (const variable of requiredEnvVars) {
    if (!process.env[variable]) {
        console.error(chalk.red(`Fatal Error: ${variable} is not set in your .env file.`));
        process.exit(1);
    }
}


const NETWORKS = {
  sepolia: {
    name: "Sepolia",
    rpcUrl: process.env.RPC_URL_SEPOLIA,
    chainId: 11155111,
    bridgeContract: process.env.T1_L1_BRIDGE_CONTRACT,
  },
  t1: {
    name: "T1 Devnet",
    rpcUrl: process.env.RPC_URL_T1,
    chainId: parseInt(process.env.T1_CHAIN_ID, 10),
    bridgeContract: process.env.T1_L2_BRIDGE_CONTRACT,
  },
  baseSepolia: {
    name: "Base Sepolia",
    rpcUrl: process.env.RPC_URL_BASE_SEPOLIA,
    chainId: 84532,
    bridgeContract: "0x4200000000000000000000000000000000000010",
  },
  arbitrumSepolia: {
    name: "Arbitrum Sepolia",
    rpcUrl: process.env.RPC_URL_ARBITRUM_SEPOLIA,
    chainId: 421614,
    bridgeContract: "0x4200000000000000000000000000000000000010",
  },
};


const T1_BRIDGE_ABI = [
  "function sendMessage(address _to, uint256 _value, bytes calldata _message, uint256 _gasLimit, uint64 _destChainId, address _callbackAddress) external payable",
];
const L2_BRIDGE_ABI = [
  "function bridgeETH(uint32 _l1Gas, bytes calldata _data) external payable",
];

const wallet = new ethers.Wallet(PRIVATE_KEY);
let transactionLogs = [];
let bridgeStatus = "Idle";
let bridgeCancelled = false;

const getShortAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;
const getRandomDelay = () => Math.random() * (60000 - 30000) + 30000;
const getRandomNumber = (min, max) => Math.random() * (max - min) + min;
const getShortHash = (hash) => `${hash.slice(0, 6)}...${hash.slice(-4)}`;

const screen = blessed.screen({
  smartCSR: true,
  title: "T1 Protocol Bridge",
  fullUnicode: true,
});

const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: 1,
  content: "{center}T1 Protocol Auto Bridge Bot - Makera1n{/center}",
  tags: true,
  style: { fg: STYLE.fg, bg: STYLE.bg },
});

const logsPanel = blessed.box({
  parent: screen,
  top: 1,
  left: 0,
  width: "65%",
  height: "100%-3",
  label: "Transaction Logs",
  border: { type: "line" },
  style: {
    fg: STYLE.fg,
    bg: STYLE.bg,
    border: { fg: STYLE.border },
    label: { fg: STYLE.fg },
  },
});

const logsBox = blessed.log({
  parent: logsPanel,
  top: 0,
  left: 1,
  width: "100%-3",
  height: "100%-2",
  scrollable: true,
  alwaysScroll: true,
  mouse: true,
  keys: true,
  vi: true,
  tags: true,
  scrollbar: { ch: " ", track: { bg: "grey" }, style: { bg: "cyan" } },
  style: { fg: STYLE.fg, bg: STYLE.bg },
});

const controlPanel = blessed.box({
  parent: screen,
  top: 1,
  left: "65%",
  width: "35%",
  height: "100%-3",
  label: "Control Panel",
  border: { type: "line" },
  style: {
    fg: STYLE.fg,
    bg: STYLE.bg,
    border: { fg: STYLE.border },
    label: { fg: STYLE.fg },
  },
});

const statusBox = blessed.box({
    parent: controlPanel,
    label: "Status",
    tags: true,
    top: 0,
    left: 0,
    width: "100%-2",
    height: 5,
    border: { type: "line" },
    style: {
        fg: STYLE.fg,
        bg: STYLE.bg,
        border: { fg: STYLE.border },
        label: { fg: STYLE.fg },
    },
    padding: { left: 1 },
});

const balanceContainer = blessed.box({
    parent: controlPanel,
    label: "Network Balances",
    tags: true,
    top: 5,
    left: 0,
    width: "100%-2",
    height: 7,
    border: { type: "line" },
    style: {
        fg: STYLE.fg,
        bg: STYLE.bg,
        border: { fg: STYLE.border },
        label: { fg: STYLE.fg },
    },
});

const balanceList = blessed.list({
    parent: balanceContainer,
    top: 0,
    left: 1,
    width: "100%-3",
    height: "100%-2",
    style: {
        fg: STYLE.fg,
        item: { fg: STYLE.fg },
        selected: STYLE.selected,
    },
    tags: true,
});

const menuContainer = blessed.box({
    parent: controlPanel,
    label: "Actions",
    tags: true,
    top: 12,
    left: 0,
    width: "100%-2",
    height: "100%-14",
    border: { type: "line" },
    style: {
        fg: STYLE.fg,
        bg: STYLE.bg,
        border: { fg: STYLE.border },
        label: { fg: STYLE.fg },
    },
});

const createMenu = (items) => blessed.list({
    parent: menuContainer,
    hidden: true,
    keys: true,
    vi: true,
    mouse: true,
    top: 0,
    left: 1,
    width: "100%-3",
    height: "100%-2",
    items: items,
    style: {
        fg: STYLE.fg,
        item: { fg: STYLE.fg },
        selected: STYLE.selected,
    },
    tags: true,
});

const mainMenu = createMenu([
    "T1 Bridge Operations",
    "L2 Bridge Operations",
    "Clear Transaction Logs",
    "Exit Application",
]);

const t1BridgeMenu = createMenu([
    "Auto Bridge: Sepolia - T1",
    "Back to Main Menu",
]);

const l2BridgeMenu = createMenu([
    "Arbitrum Sepolia - Base Sepolia",
    "Base Sepolia - Arbitrum Sepolia",
    "Back to Main Menu",
]);

const telegramFooter = blessed.box({
  parent: screen,
  bottom: 1,
  left: 0,
  width: "100%",
  height: 1,
  tags: true,
  content: "{center}Telegram: t.me/earningdropshub | Youtube: @earningdropshub{/center}",
  style: { fg: STYLE.info, bg: STYLE.bg },
});

const footer = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 1,
  tags: true,
  content: "{center}(Q)uit | (M)enu | (C)lear Logs | (S)top Operation{/center}",
  style: { fg: STYLE.fg, bg: STYLE.bg },
});

const promptBox = blessed.prompt({
    parent: screen,
    label: "Input Required",
    tags: true,
    border: { type: "line" },
    height: 5,
    width: "half",
    top: "center",
    left: "center",
    keys: true,
    vi: true,
    mouse: true,
    style: {
        fg: STYLE.fg,
        bg: STYLE.bg,
        border: { fg: STYLE.border },
        label: { fg: STYLE.fg },
    },
});

function wordWrap(text, maxWidth) {
    if (!text || text.length <= maxWidth || maxWidth <= 0) {
        return [text || ''];
    }

    const lines = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
        if (word.length > maxWidth) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
            }
            let tempWord = word;
            while (tempWord.length > maxWidth) {
                lines.push(tempWord.slice(0, maxWidth));
                tempWord = tempWord.slice(maxWidth);
            }
            currentLine = tempWord;
        } else {
            const testLine = currentLine.length === 0 ? word : `${currentLine} ${word}`;
            if (testLine.length > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    return lines;
}

function addLog(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();

  const labels = {
    bridge:  `{${STYLE.bridge}-fg}[BRIDGE]{/}`,
    system:  `[SYSTEM]`,
    error:   `{${STYLE.error}-fg}[ERROR]{/}`,
    success: `{${STYLE.success}-fg}[SUCCESS]{/}`,
    warning: `{${STYLE.warning}-fg}[WARNING]{/}`,
    info:    `{${STYLE.info}-fg}[INFO]{/}`,
  };

  const plainLabels = {
    bridge:  `[BRIDGE]`,
    system:  `[SYSTEM]`,
    error:   `[ERROR]`,
    success: `[SUCCESS]`,
    warning: `[WARNING]`,
    info:    `[INFO]`,
  };

  const maxLength = Math.max(...Object.values(plainLabels).map(l => l.length));
  const currentLabel = labels[type] || labels.info;
  const currentPlainLabel = plainLabels[type] || plainLabels.info;
  const labelPadding = ' '.repeat(maxLength - currentPlainLabel.length);
  const prefix = `${currentLabel}${labelPadding} `;
  const visualPrefix = `[${timestamp}] ${prefix}`;
  const plainPrefix = visualPrefix.replace(/\{[^\}]+\}/g, '');
  const padding = ' '.repeat(plainPrefix.length);
  const logBoxInnerWidth = logsBox.iwidth ? logsBox.iwidth - 1 : 70;
  const messageWrapWidth = logBoxInnerWidth - plainPrefix.length;
  const wrappedLines = wordWrap(message, messageWrapWidth > 0 ? messageWrapWidth : 1);

  const firstLine = `${visualPrefix}${wrappedLines[0] || ''}`;
  logsBox.log(firstLine);
  transactionLogs.push(firstLine);

  for (let i = 1; i < wrappedLines.length; i++) {
    const subsequentLine = `${padding}${wrappedLines[i]}`;
    logsBox.log(subsequentLine);
    transactionLogs.push(subsequentLine);
  }

  while (transactionLogs.length > 500) {
    transactionLogs.shift();
  }

  screen.render();
}


function clearTransactionLogs() {
  transactionLogs = [];
  logsBox.setContent("");
  addLog("Transaction logs cleared.", "system");
}

function updateStatus() {
  const statusColor = bridgeStatus === "Running" ? STYLE.success : STYLE.warning;
  const content =
    ` Wallet: {${STYLE.info}-fg}${getShortAddress(wallet.address)}{/}\n` +
    ` Status: {${statusColor}-fg}${bridgeStatus}{/}`;

  statusBox.setContent(content);
  screen.render();
}

async function updateBalances() {
  const networks = [NETWORKS.sepolia, NETWORKS.t1, NETWORKS.baseSepolia, NETWORKS.arbitrumSepolia];
  const balanceItems = [];

  try {
    for (const network of networks) {
      if (network.rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(network.rpcUrl);
          const balance = await provider.getBalance(wallet.address);
          const formattedBalance = parseFloat(ethers.formatEther(balance)).toFixed(5);
          balanceItems.push(`${network.name}: {${STYLE.success}-fg}${formattedBalance} ETH{/}`);
        } catch (e) {
          balanceItems.push(`${network.name}: {${STYLE.error}-fg}Error{/}`);
        }
      } else {
        balanceItems.push(`${network.name}: {${STYLE.warning}-fg}No RPC{/}`);
      }
    }
    balanceList.setItems(balanceItems);
    screen.render();
  } catch (e) {
    addLog(`Failed to refresh balances: ${e.message}`, "error");
  }
}

function showMenu(menuToShow) {
  [mainMenu, t1BridgeMenu, l2BridgeMenu].forEach(menu => menu.hide());
  menuToShow.show();
  menuToShow.focus();
  screen.render();
}

function askForLoopCount(callback) {
  promptBox.input("Enter number of bridge transactions:", "", (err, value) => {
    if (err || value === null) {
      addLog("Operation cancelled.", "warning");
      showMenu(mainMenu);
      return;
    }

    const count = parseInt(value, 10);
    if (!isNaN(count) && count > 0) {
      callback(count);
    } else {
      addLog("Invalid input. Please enter a positive number.", "error");
      showMenu(mainMenu);
    }
  });
}

async function waitWithCancel(delay) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      clearInterval(interval);
      resolve('completed');
    }, delay);

    const interval = setInterval(() => {
      if (bridgeCancelled) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve('cancelled');
      }
    }, 100);
  });
}

async function executeL2Bridge(sourceNetwork, destNetwork, amount) {
  addLog(`Bridging ${ethers.formatEther(amount)} ETH from ${sourceNetwork.name} to ${destNetwork.name}`, "bridge");

  try {
    const provider = new ethers.JsonRpcProvider(sourceNetwork.rpcUrl);
    const bridgeWallet = wallet.connect(provider);

    const balance = await provider.getBalance(bridgeWallet.address);
    if (balance < amount) {
      addLog(`Insufficient balance on ${sourceNetwork.name}. Required: ${ethers.formatEther(amount)} ETH`, "error");
      return false;
    }

    const bridgeContract = new ethers.Contract(sourceNetwork.bridgeContract, L2_BRIDGE_ABI, bridgeWallet);
    addLog(`Submitting transaction to ${sourceNetwork.name} bridge...`, "system");

    const tx = await bridgeContract.bridgeETH(200000, "0x", {
      value: amount,
      gasLimit: 1000000
    });

    addLog(`Transaction sent: ${getShortHash(tx.hash)}`, "bridge");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      addLog(`Bridge tx successful on ${sourceNetwork.name}! Gas used: ${receipt.gasUsed.toString()}`, "success");
      return true;
    } else {
      addLog(`Bridge tx failed on ${sourceNetwork.name}`, "error");
      return false;
    }
  } catch (error) {
    addLog(`Bridge error on ${sourceNetwork.name}: ${error.reason || error.message}`, "error");
    return false;
  }
}

async function executeT1Bridge(sourceNetwork, destNetwork, amount) {
  addLog(`Bridging ${ethers.formatEther(amount)} ETH from ${sourceNetwork.name} to ${destNetwork.name}`, "bridge");

  try {
    const provider = new ethers.JsonRpcProvider(sourceNetwork.rpcUrl);
    const bridgeWallet = wallet.connect(provider);

    const balance = await provider.getBalance(bridgeWallet.address);
    if (balance < amount) {
      addLog(`Insufficient balance on ${sourceNetwork.name}. Required: ${ethers.formatEther(amount)} ETH`, "error");
      return false;
    }

    const bridgeContract = new ethers.Contract(sourceNetwork.bridgeContract, T1_BRIDGE_ABI, bridgeWallet);
    addLog(`Submitting T1 bridge message...`, "system");

    const tx = await bridgeContract.sendMessage(
      wallet.address,
      amount,
      "0x",
      200000,
      destNetwork.chainId,
      wallet.address, {
        value: amount,
        gasLimit: 1000000
      }
    );

    addLog(`T1 bridge tx sent: ${getShortHash(tx.hash)}`, "bridge");
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      addLog(`T1 bridge tx successful! Gas used: ${receipt.gasUsed.toString()}`, "success");
      return true;
    } else {
      addLog(`T1 bridge tx failed`, "error");
      return false;
    }
  } catch (error) {
    addLog(`T1 bridge error: ${error.reason || error.message}`, "error");
    return false;
  }
}

async function runAutoL2Bridge(source, destination, loopCount) {
  if (bridgeStatus === 'Running') {
    addLog("Bridge operation already in progress.", "warning");
    return;
  }

  bridgeStatus = "Running";
  bridgeCancelled = false;
  updateStatus();
  addLog(`Starting L2 bridge: ${source.name} <-> ${destination.name} (${loopCount} cycles)`, "system");

  for (let i = 1; i <= loopCount; i++) {
    if (bridgeCancelled) {
      addLog("Bridge operation stopped by user.", "warning");
      break;
    }

    const randomAmount = getRandomNumber(0.0001, 0.001);
    const amount = ethers.parseEther(randomAmount.toFixed(6));

    addLog(`--- Cycle ${i}/${loopCount} ---`, "system");
    await updateBalances();

    const success = await executeL2Bridge(source, destination, amount);

    if (success) {
      const waitTime = getRandomNumber(120000, 300000);
      addLog(`Waiting ${Math.round(waitTime/60000)} mins for bridge completion...`, "system");
      await waitWithCancel(waitTime);
    } else {
      addLog("Stopping bridge due to tx failure.", "error");
      break;
    }

    [source, destination] = [destination, source];
    if (i < loopCount && !bridgeCancelled) {
      const delayTime = getRandomDelay(); 
      addLog(`Delaying ${Math.round(delayTime/1000)}s before next cycle...`, "system");
      const status = await waitWithCancel(delayTime);
      if (status === 'cancelled') break;
    }
  }

  bridgeStatus = "Idle";
  bridgeCancelled = false;
  updateStatus();
  await updateBalances();
  addLog("Automated L2 bridge operation finished.", "success");
}


async function runAutoT1Bridge(loopCount) {
  if (bridgeStatus === 'Running') {
    addLog("Bridge operation already in progress.", "warning");
    return;
  }

  bridgeStatus = "Running";
  bridgeCancelled = false;
  updateStatus();
  addLog(`Starting T1 bridge: Sepolia <-> T1 (${loopCount} cycles)`, "system");

  let source = NETWORKS.sepolia;
  let destination = NETWORKS.t1;

  for (let i = 1; i <= loopCount; i++) {
    if (bridgeCancelled) {
      addLog("T1 bridge operation stopped by user.", "warning");
      break;
    }

    const randomAmount = getRandomNumber(0.0001, 0.001);
    const amount = ethers.parseEther(randomAmount.toFixed(6));

    addLog(`--- T1 Cycle ${i}/${loopCount} ---`, "system");
    await updateBalances();

    const success = await executeT1Bridge(source, destination, amount);

    if (success) {
      const waitTime = getRandomNumber(300000, 600000);
      addLog(`Waiting ${Math.round(waitTime/60000)} mins for T1 bridge completion...`, "system");
      await waitWithCancel(waitTime);
    } else {
      addLog("Stopping T1 bridge due to tx failure.", "error");
      break;
    }

    [source, destination] = [destination, source];

    if (i < loopCount && !bridgeCancelled) {
      const delayTime = getRandomDelay();
      addLog(`Delaying ${Math.round(delayTime/1000)}s before next cycle...`, "system");
      const status = await waitWithCancel(delayTime);
      if (status === 'cancelled') break;
    }
  }

  bridgeStatus = "Idle";
  bridgeCancelled = false;
  updateStatus();
  await updateBalances();
  addLog("Automated T1 bridge operation finished.", "success");
}

screen.key(["escape", "q", "C-c"], () => process.exit(0));
screen.key(["m", "M"], () => showMenu(mainMenu));
screen.key(["c", "C"], () => clearTransactionLogs());
screen.key(["s", "S"], () => {
  if (bridgeStatus === 'Running') {
    bridgeCancelled = true;
    addLog("Stop signal sent. Finishing current step...", "warning");
  } else {
    addLog("No operation currently running.", "info");
  }
});

mainMenu.on("select", (item) => {
  const selected = item.getText().trim();
  if (selected.includes("T1 Bridge")) {
    showMenu(t1BridgeMenu);
  } else if (selected.includes("L2 Bridge")) {
    showMenu(l2BridgeMenu);
  } else if (selected.includes("Clear")) {
    clearTransactionLogs();
  } else if (selected.includes("Exit")) {
    process.exit(0);
  }
});

t1BridgeMenu.on("select", (item) => {
  const selected = item.getText().trim();
  if (selected.includes("Auto Bridge")) {
    askForLoopCount((count) => runAutoT1Bridge(count));
  } else if (selected.includes("Back")) {
    showMenu(mainMenu);
  }
});

l2BridgeMenu.on("select", (item) => {
    const selected = item.getText().trim();
    if (selected.includes("Back")) {
        showMenu(mainMenu);
        return;
    }

    let source, dest;
    if (selected.startsWith("Arbitrum Sepolia")) {
        source = NETWORKS.arbitrumSepolia;
        dest = NETWORKS.baseSepolia;
    } else if (selected.startsWith("Base Sepolia")) {
        source = NETWORKS.baseSepolia;
        dest = NETWORKS.arbitrumSepolia;
    }

    if (source && dest) {
        askForLoopCount((count) => runAutoL2Bridge(source, dest, count));
    }
});

async function main() {
  addLog("Initializing...", "system");
  addLog(`Wallet: ${getShortAddress(wallet.address)}`, "info");

  updateStatus();
  showMenu(mainMenu);

  addLog("Fetching initial network balances...", "system");
  await updateBalances();

  setInterval(updateBalances, 60000);

  addLog("Bridge bot is ready. Select an action.", "success");
  addLog("Note: Verify all Sepolia RPC endpoints and contracts if needed.", "warning");

  screen.render();
}

main().catch(err => {
  console.error(chalk.red("A fatal error occurred:"), err);
  process.exit(1);
});
