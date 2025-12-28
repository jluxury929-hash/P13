const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, Interface } = require('ethers');
require('dotenv').config();

// 1. BOOTSTRAP: SYSTEM MAXIMIZATION
console.log("-----------------------------------------");
console.log("🟢 [BOOT] 250 ETH OMNISCIENT TITAN INITIALIZING...");

// AUTO-CONVERT WSS TO HTTPS FOR EXECUTION (Premium Stability)
const RAW_WSS = process.env.WSS_URL || "";
const EXECUTION_URL = RAW_WSS.replace("wss://", "https://");

const CONFIG = {
    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ DUAL-LANE INFRASTRUCTURE
    WSS_URL: RAW_WSS,          // Listener (Low Latency)
    RPC_URL: EXECUTION_URL,    // Executor (High Reliability)
    
    // 🏦 ASSETS
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    
    // 🔮 ORACLES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F", // Base L1 Fee
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", // ETH Price
    
    // ⚙️ STRATEGY SETTINGS
    LOAN_AMOUNT: ethers.parseEther("250"), // FIXED 250 ETH "HEAVY" STRIKE
    GAS_LIMIT: 1500000n, // Higher buffer for complex routing of 250 ETH
    PRIORITY_BRIBE: 15n, // 15% Tip to be FIRST
    MIN_NET_PROFIT: "0.02" // Minimum profit floor (Higher due to risk)
};

// Global State
let currentEthPrice = 0;
let nextNonce = 0;

async function startTitan250() {
    // A. KEY SANITIZER
    let rawKey = process.env.TREASURY_PRIVATE_KEY;
    if (!rawKey) { console.error("❌ FATAL: Private Key missing."); process.exit(1); }
    const cleanKey = rawKey.trim();

    try {
        // B. DUAL-PROVIDER SETUP
        const httpProvider = new JsonRpcProvider(CONFIG.RPC_URL);
        const wsProvider = new WebSocketProvider(CONFIG.WSS_URL);
        const signer = new Wallet(cleanKey, httpProvider); // Signer uses HTTP (Stable)
        
        await wsProvider.ready;
        console.log(`✅ TITAN 250 ONLINE | EXECUTOR: ${CONFIG.RPC_URL.substring(0, 25)}...`);

        // C. CONTRACTS
        const oracleContract = new Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], httpProvider);
        const priceFeed = new Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);
        const titanIface = new Interface(["function requestTitanLoan(address,uint256,address[])"]);

        // Sync Nonce
        nextNonce = await httpProvider.getTransactionCount(signer.address);

        // D. LIVE PRICE TRACKER & SCANNER
        wsProvider.on("block", async (blockNum) => {
            try {
                // 1. Update Price
                const [, price] = await priceFeed.latestRoundData();
                currentEthPrice = Number(price) / 1e8;
                process.stdout.write(`\r💎 BLOCK: ${blockNum} | ETH: $${currentEthPrice.toFixed(2)} | Titan 250 Hunting... `);

                // 2. FETCH BLOCK (HTTP Stability)
                const block = await httpProvider.getBlock(blockNum, true);
                
                // 3. TRIGGER IF VOLATILITY DETECTED
                // We scan every block because 250 ETH opportunities are rare and fleeting
                if (block && block.transactions.length > 0) {
                    await executeTitan250Strike(httpProvider, signer, titanIface, oracleContract);
                }

            } catch (e) { /* Ignore block fetch errors */ }
        });

        // E. IMMORTALITY PROTOCOL
        wsProvider.websocket.onclose = () => {
            console.warn("\n⚠️ CONNECTION LOST. REBOOTING...");
            process.exit(1); 
        };

    } catch (e) {
        console.error(`\n❌ CRITICAL: ${e.message}`);
        setTimeout(startTitan250, 1000);
    }
}

async function executeTitan250Strike(provider, signer, iface, oracle) {
    try {
        const path = [CONFIG.WETH, CONFIG.USDC];
        const loanAmount = CONFIG.LOAN_AMOUNT; // FIXED 250 ETH

        // 1. ENCODE DATA (For L1 Fee Calc)
        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            CONFIG.WETH, loanAmount, path
        ]);

        // 2. PRE-FLIGHT (Static Call + L1 Fee + Gas Data)
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CONFIG.TARGET_CONTRACT, data: strikeData, from: signer.address }).catch(() => null),
            oracle.getL1Fee(strikeData),
            provider.getFeeData()
        ]);

        if (!simulation) return; // Reverted

        // 3. MAXIMIZED COST CALCULATION
        // Aave V3 Fee: 0.05% of 250 ETH = 0.125 ETH (CRITICAL CALCULATION)
        const aaveFee = (loanAmount * 5n) / 10000n;
        
        // Priority Bribe: 15%
        const aggressivePriority = (feeData.maxPriorityFeePerGas * (100n + CONFIG.PRIORITY_BRIBE)) / 100n;
        
        const l2Cost = CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const totalCost = l2Cost + l1Fee + aaveFee;
        
        const netProfit = BigInt(simulation) - totalCost;

        // 4. EXECUTION
        if (netProfit > ethers.parseEther(CONFIG.MIN_NET_PROFIT)) {
            const profitUSD = parseFloat(ethers.formatEther(netProfit)) * currentEthPrice;
            console.log(`\n💎 250 ETH HEAVY STRIKE DETECTED`);
            console.log(`💰 Net Profit: ${ethers.formatEther(netProfit)} ETH (~$${profitUSD.toFixed(2)})`);
            console.log(`📉 Costs Paid: ${ethers.formatEther(aaveFee)} ETH (Flash Fee) + ${ethers.formatEther(l2Cost)} ETH (Gas)`);
            
            const tx = await signer.sendTransaction({
                to: CONFIG.TARGET_CONTRACT,
                data: strikeData,
                gasLimit: CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority, // Bribe
                nonce: nextNonce++,
                type: 2
            });
            
            console.log(`🚀 BROADCASTED: ${tx.hash}`);
            await tx.wait();
        }
    } catch (e) {
        if (e.message.includes("nonce")) nextNonce = await provider.getTransactionCount(signer.address);
    }
}

// EXECUTE
if (require.main === module) {
    startTitan250().catch(e => {
        console.error("FATAL ERROR. RESTARTING...");
        setTimeout(startTitan250, 1000);
    });
}
