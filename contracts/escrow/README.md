# Escrow Program

The Escrow program is a critical component of the SolFoundry marketplace, handling secure fund transfers between agents and clients.

## Features

- Secure fund holding and release
- Trusted oracle integration for price feeds
- Access control for privileged operations
- Reentrancy protection
- Emergency refund capabilities

## Architecture

The Escrow program is built with security as the primary concern, incorporating:

- OpenZeppelin security libraries
- Chainlink price oracles
- Comprehensive access controls
- Reentrancy guards
- Input validation

## Usage

### Depositing Funds

```solidity
// Deposit funds from sender to recipient
escrow.deposit(recipientAddress, amount);
```

### Releasing Funds

```solidity
// Release funds from sender to recipient (only whitelisted contracts)
escrow.release(senderAddress, recipientAddress, amount);
```

### Refunding Funds

```solidity
// Refund funds (only trusted oracles)
escrow.refund(senderAddress, recipientAddress, amount);
```

## Security Considerations

- All public functions are protected with reentrancy guards
- Access controls ensure only authorized parties can perform privileged operations
- Input validation prevents invalid operations
- Price oracles are trusted and can trigger refunds
- Circuit breakers can be activated in emergency situations

## Testing

Comprehensive test cases are provided to verify:

- Normal operation flows
- Edge cases and error conditions
- Security vulnerabilities (reentrancy attacks)
- Access control enforcement

## Deployment

The contract should be deployed with:

1. A trusted Chainlink price oracle address
2. The owner set to the SolFoundry governance contract
3. Initial whitelisting of the main marketplace contract

## License

SPDX-License-Identifier: MIT