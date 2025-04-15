# Hardhat Project

This project is designed for high-concurrency transaction testing using Hardhat. It includes:

- A set of test contracts
- Corresponding contract deployment and governance scripts
- Scripts for testing various transaction types, such as native token transfers and ERC20 transfers

## Available Scripts

Run the following commands using `yarn`:

```bash
yarn install         # Install project dependencies
yarn build           # Compile contracts and generate TypeScript bindings
yarn deploy          # Deploy the contract
yarn sponsor         # Run the task related to the sponsor account
yarn gov             # Run the governance task
yarn transfer        # Perform a native token transfer or ERC20 transfer
yarn proxytransfer   # Perform a proxy-based transfer
```

## Considerations for High-Concurrency Testing on macOS
To ensure reliable local testing under high concurrency, keep the following points in mind:

#### 1.Use 127.0.0.1 instead of localhost
Avoid the fallback to IPv6 (::1), which may cause connection delays or failures if IPv6 loopback is not properly handled.

#### 2.Increase kern.ipc.somaxconn
This parameter controls the maximum number of pending connections in the server's listen queue. A low value can lead to refused connections (ECONNRESET) when the queue fills up under high load.

#### 3.Expand the local ephemeral port range
Ensure there are enough available outbound ports to prevent EADDRNOTAVAIL errors during bursts of connection attempts.