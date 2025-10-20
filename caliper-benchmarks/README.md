# MACI Caliper Benchmarks

Performance benchmarking suite for MACI (Minimum Anti-Collusion Infrastructure) Poll contract using Hyperledger Caliper.

## Overview

This benchmark suite measures the performance of vote submission operations on MACI Poll contracts. It uses Hyperledger Caliper to generate workload and collect performance metrics including throughput, latency, and resource utilization.

## Features

- **Encrypted Vote Submission**: Benchmarks the `publishMessage` function with properly encrypted vote commands
- **Multi-Worker Support**: Distributed load generation across multiple worker processes
- **Configurable Parameters**: Flexible configuration via environment variables
- **Retry Logic**: Built-in retry mechanism for transient failures
- **Comprehensive Logging**: Detailed logging for debugging and analysis

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Access to an Ethereum network (testnet or local)
- Deployed MACI contracts
- Worker accounts with sufficient ETH for gas

## Installation

1. **Install dependencies:**
   ```bash
   cd caliper-benchmarks
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   ```

3. **Configure your environment variables** (see Configuration section below)

## Configuration

### Environment Variables

Edit the `.env` file with your configuration:

#### Network Configuration
```env
ETHEREUM_RPC_URL=wss://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ETHEREUM_NETWORK_NAME=MACI-Ethereum-Test
ETHEREUM_CHAIN_ID=11155111
```

#### Contract Configuration
```env
CONTRACT_DEPLOYER_ADDRESS=0xYourDeployerAddress
CONTRACT_DEPLOYER_PRIVATE_KEY=YourDeployerPrivateKey
POLL_CONTRACT_ADDRESS=0xYourPollContractAddress
```

#### Worker Configuration
```env
# Comma-separated list of private keys for benchmark workers
WORKER_PRIVATE_KEYS=key1,key2,key3
```

#### MACI Paths
```env
# Paths relative to workspace root
MACI_DOMAINOBJS_PATH=../packages/domainobjs/build/ts/index.js
MACI_SDK_PATH=../packages/sdk/build/ts/index.js
```

#### Benchmark Parameters
```env
BENCHMARK_WORKERS=2
BENCHMARK_TX_NUMBER=20
BENCHMARK_TPS=0.5
BENCHMARK_POLL_ID=0
BENCHMARK_MAX_VOTE_OPTIONS=25
BENCHMARK_MAX_VOTE_WEIGHT=100
BENCHMARK_USERS_PER_WORKER=10
```

### Benchmark Configuration

Edit `benchmarks/scenario/simple/config.yaml` to adjust:
- Number of workers
- Transaction count per round
- Rate control (TPS)
- Workload arguments

## Usage

### Run Benchmarks

```bash
npm run benchmark
```

This command will:
1. Generate the network configuration from your `.env` file
2. Launch the Caliper benchmark manager
3. Execute the configured test rounds
4. Generate a performance report

### Generate Configuration Only

```bash
npm run generate-config
```

## Project Structure

```
caliper-benchmarks/
├── .env.example              # Environment variable template
├── .gitignore               # Git ignore rules
├── package.json             # Node.js dependencies and scripts
├── README.md                # This file
│
├── abi/
│   └── Poll.json            # Poll contract ABI
│
├── benchmarks/
│   └── scenario/
│       └── simple/
│           └── config.yaml  # Benchmark scenario configuration
│
├── networks/
│   └── ethereum/
│       ├── test-network.json          # Generated network config (gitignored)
│       └── test-network.json.template # Template file
│
├── scripts/
│   └── generate-config.js   # Configuration generator script
│
└── workload/
    └── ethereum/
        └── submitVote.js    # Vote submission workload module
```

## Workload Module

The `submitVote.js` workload module handles:

1. **Initialization**: Sets up worker identity and verifies poll state
2. **Vote Creation**: Generates encrypted vote commands using MACI cryptography
3. **Transaction Submission**: Publishes vote messages to the Poll contract
4. **Error Handling**: Retries transient failures automatically

### Key Features

- **Encryption**: Uses ECDH key exchange to encrypt vote commands
- **Signing**: Signs commands with worker's MACI private key  
- **Verification**: Checks voting period and poll state before submission
- **Retry Logic**: Configurable retry mechanism for network issues

## Performance Metrics

Caliper collects the following metrics:

- **Throughput**: Transactions per second (TPS)
- **Latency**: Transaction confirmation time
  - Min, Max, Average
  - Percentiles (50th, 75th, 95th, 99th)
- **Success Rate**: Percentage of successful transactions
- **Resource Usage**: CPU, memory, network (if Prometheus configured)

## Troubleshooting

### Common Issues

**1. Missing environment variables**
```
Error: Missing required environment variables
```
Solution: Copy `.env.example` to `.env` and fill in all values

**2. Voting period not active**
```
Error: Voting period has not started yet / has ended
```
Solution: Verify poll start/end dates match current time

**3. Worker private keys**
```
Error: No worker private keys configured
```
Solution: Add comma-separated private keys to `WORKER_PRIVATE_KEYS` in `.env`

**4. Contract connection issues**
```
Error: Could not connect to contract
```
Solution: Verify RPC URL and poll contract address are correct

**5. Path resolution errors**
```
Error: Cannot find module
```
Solution: Verify `MACI_DOMAINOBJS_PATH` points to correct build output

## Security Considerations

⚠️ **IMPORTANT**: Never commit sensitive data to version control

- Keep `.env` file secure and never commit it
- Use separate keys for testing/production
- Rotate private keys regularly
- Use testnet for development
- Review `.gitignore` to ensure sensitive files are excluded

## Best Practices

1. **Testing**: Always test on testnet before mainnet
2. **Gas Limits**: Monitor gas usage and adjust limits as needed
3. **Rate Limiting**: Start with low TPS and increase gradually
4. **Monitoring**: Use Prometheus integration for resource monitoring
5. **Logging**: Review logs after benchmark runs for errors
6. **Workers**: Use multiple workers for realistic load testing

## Contributing

When contributing code:

1. Follow existing code style and conventions
2. Add JSDoc comments for new functions
3. Include error handling for all external calls
4. Test changes thoroughly before submitting
5. Update documentation as needed

## License

ISC

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Caliper documentation: https://hyperledger.github.io/caliper/
3. Review MACI documentation: https://maci.pse.dev/

## Changelog

### Version 1.0.0
- Initial release with basic vote submission benchmarking
- Environment variable configuration
- Retry logic and error handling
- Comprehensive documentation
