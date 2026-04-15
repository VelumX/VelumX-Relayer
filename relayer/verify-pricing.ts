import { PricingOracleService } from './src/services/PricingOracleService.js';
import dotenv from 'dotenv';
dotenv.config();

async function testPricing() {
    const oracle = new PricingOracleService();
    
    const tokens = [
        'STX',
        'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex', // ALEX
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',     // USDCx
        'SP3Y2ZSH8P7D50B0JLZVGKMBC7PX3RVRGWJKWKY38.token-aeusdc', // aeUSDC
        'SP3DX3H4FEYZJZ586MFBS25ZW3WTPQE9P6ZAZ6XN.dot-token',  // xBTC (Wait, this is an example)
        'SP3NE50G7MKSLRQD4J5M2NG9YV6V9MKM7F14VTHC.token-lisa'   // LiSTX
    ];

    console.log('--- STARTING PRICING VERIFICATION ---');
    
    for (const token of tokens) {
        console.log(`\nTesting: ${token}`);
        try {
            const meta = await oracle.getTokenMetadata(token);
            console.log(`Metadata: ${meta.symbol} (${meta.decimals} decimals)`);
            
            const usdPrice = await oracle.getTokenUsdPrice(token, meta.decimals);
            console.log(`USD Price: $${usdPrice}`);
            
            const rate = await oracle.getTokenRate(token, meta.decimals);
            console.log(`Rate (STX per token): ${rate}`);
        } catch (e) {
            console.error(`Failed for ${token}:`, e);
        }
    }
    
    console.log('\n--- VERIFICATION COMPLETE ---');
}

testPricing();
