/**
 * VorteX Convex Client
 * JavaScript adaptation of official Convex client patterns
 * Based on convex-java/ConvexJSON.java structure
 */
class ConvexClient {
    constructor(peerUrl = 'http://peer.convex.live:8080') {
        this.peerUrl = peerUrl;
        this.address = null;
        this.keyPair = null;
        this.sequence = 0;
        this.isConnected = false;
        
        // Connection timeout (like official client)
        this.timeout = 30000; // 30 seconds
    }

    /**
     * Connect to Convex network (similar to official connect method)
     */
    static async connect(peerServerURL, address = null, keyPair = null) {
        const client = new ConvexClient(peerServerURL);
        await client.initialize();
        
        if (address && keyPair) {
            client.setAddress(address);
            client.setKeyPair(keyPair);
        } else {
            await client.createDemoAccount();
        }
        
        return client;
    }

    /**
     * Initialize connection (test peer availability)
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Convex connection...');
            
            // Test connection with simple query (like official client status check)
            const testResult = await this.query('(+ 2 2 2 1)', '#12');
            if (testResult.value !== 7) {
                throw new Error('Peer connection test failed');
            }
            
            this.isConnected = true;
            console.log('✅ Convex peer connection established');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Convex connection:', error);
            throw error;
        }
    }

    /**
     * Set address for this connection (like official client)
     */
    setAddress(address) {
        this.address = address;
        this.sequence = 0; // Reset sequence for new address
    }

    /**
     * Set key pair for this connection (like official client)
     */
    setKeyPair(keyPair) {
        this.keyPair = keyPair;
    }

    /**
     * Create demo account for testing
     */
    async createDemoAccount() {
        try {
            // Try official account creation endpoint
            const response = await fetch(`${this.peerUrl}/api/v1/createAccount`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountKey: "d82e78594610f708ad47f666bbacbab1711760652cb88bf7515ed6c3ae84a08d"
                })
            });
            
            if (response.ok) {
                const accountData = await response.json();
                this.setAddress(accountData.address);
                this.setKeyPair("d82e78594610f708ad47f666bbacbab1711760652cb88bf7515ed6c3ae84a08d");
                
                console.log('✅ Created new account:', accountData);
                await this.requestFaucetCoins();
                return accountData;
            }
        } catch (error) {
            console.log('Account creation not available, using demo fallback');
        }
        
        // Fallback to demo address
        this.setAddress("#12");
        this.setKeyPair("demo");
        console.log('📱 Using demo account:', this.address);
    }

    /**
     * Request faucet coins (if available)
     */
    async requestFaucetCoins() {
        try {
            const response = await fetch(`${this.peerUrl}/api/v1/faucet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.address,
                    amount: "10000000"
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Received faucet coins:', data);
            }
        } catch (error) {
            console.log('Faucet not available');
        }
    }

    /**
     * Query Convex network (read-only, like official client)
     */
    async query(source, address = this.address) {
        try {
            const response = await fetch(`${this.peerUrl}/api/v1/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address,
                    source: source
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Query failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errorCode) {
                throw new Error(`Convex error: ${result.value || result.errorCode}`);
            }

            return result;
        } catch (error) {
            console.error('❌ Query failed:', error.message);
            throw error;
        }
    }

    /**
     * Execute transaction (like official client transact method)
     */
    async transact(source) {
        if (!this.isConnected) {
            throw new Error('Not connected to Convex network');
        }

        if (!this.address) {
            throw new Error('No address set for transaction');
        }

        try {
            console.log('📤 Executing transaction:', source);
            
            const response = await fetch(`${this.peerUrl}/api/v1/transact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.address,
                    source: source,
                    seed: this.keyPair
                }),
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`Transaction failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.errorCode) {
                throw new Error(`Transaction error: ${result.value || result.errorCode}`);
            }

            this.sequence++; // Increment sequence like official client
            console.log('✅ Transaction completed:', result);
            console.log('⛽ Gas used:', result.info?.juice);
            
            return result;
        } catch (error) {
            console.error('❌ Transaction failed:', error.message);
            throw error;
        }
    }

    /**
     * Get account balance (convenience method)
     */
    async getBalance(address = this.address) {
        try {
            const result = await this.query(`(balance ${address})`);
            return result.value || 0;
        } catch (error) {
            console.error('Failed to get balance:', error.message);
            return 0;
        }
    }

    /**
     * Get account information (like official client)
     */
    async getAccountInfo(address = this.address) {
        try {
            const response = await fetch(`${this.peerUrl}/api/v1/accounts/${address.replace('#', '')}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to get account info:', error.message);
        }
        return null;
    }

    /**
     * Torus DEX helper methods
     */
    async buyTokens(tokenAddress, amount) {
        const source = `(do (import exchange.torus :as torus) (torus/buy-tokens ${tokenAddress} ${amount}))`;
        return await this.transact(source);
    }

    async sellTokens(tokenAddress, amount) {
        const source = `(do (import exchange.torus :as torus) (torus/sell-tokens ${tokenAddress} ${amount}))`;
        return await this.transact(source);
    }

    async getMarket(tokenAddress) {
        const source = `(do (import exchange.torus :as torus) (torus/get-market ${tokenAddress}))`;
        try {
            const result = await this.query(source);
            return result.value;
        } catch (error) {
            return null;
        }
    }

    /**
     * Close connection (like official client)
     */
    close() {
        this.isConnected = false;
        this.address = null;
        this.keyPair = null;
        this.sequence = 0;
        console.log('📴 Convex connection closed');
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.isConnected;
    }
}

// Export for use (similar to official client export)
window.ConvexClient = ConvexClient;