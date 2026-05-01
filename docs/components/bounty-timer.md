
# Bounty Countdown Timer

## Overview

The Bounty Countdown Timer is a component designed to display the remaining time until a bounty can be claimed. This timer helps users track the deadline for claiming bounties, ensuring they don't miss out on rewards.

## Purpose

The timer is particularly useful in bounty systems where:
- Bounties have a specific expiration time.
- Users need to be aware of the remaining time to claim their rewards.
- Deadlines are critical for maintaining the integrity of the bounty system.

## Usage

The Bounty Countdown Timer component can be integrated into bounty-related interfaces to provide real-time updates on the time remaining until a bounty expires.

### Example

```html
<bounty-timer
  :bounty-id="bounty.id"
  :expiration-time="bounty.expirationTime"
></bounty-timer>
```

### Props

- **bounty-id** (`String`): The unique identifier for the bounty.
- **expiration-time** (`String`): The timestamp when the bounty expires.

## How It Works

1. **Input**: The component receives the bounty ID and expiration time.
2. **Calculation**: It calculates the remaining time between the current time and the expiration time.
3. **Display**: It displays the remaining time in a user-friendly format (e.g., `Days:Hours:Minutes:Seconds`).

## Customization

You can customize the appearance and behavior of the timer by passing additional props or overriding styles.

### Example Customization

```html
<bounty-timer
  :bounty-id="bounty.id"
  :expiration-time="bounty.expirationTime"
  :show-alert="true"
  :alert-time="3600000" <!-- Alert 1 hour before expiration -->
></bounty-timer>
```

### Props for Customization

- **show-alert** (`Boolean`, optional): Whether to show an alert when the remaining time is close to the specified threshold.
- **alert-time** (`Number`, optional): The time threshold (in milliseconds) before expiration to show an alert.

## Notes

- Ensure the expiration time is provided in a format that the component can parse (e.g., Unix timestamp or ISO 8601 string).
- The timer updates in real-time as the expiration time approaches.
