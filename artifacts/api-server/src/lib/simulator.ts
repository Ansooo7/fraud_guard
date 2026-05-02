import { analyzeFraud } from "./fraud-engine";
import { broadcastTransaction, broadcastAlert } from "./websocket";
import { logger } from "./logger";

const MERCHANTS = [
  { name: "Starbucks", category: "food", avgAmount: 8 },
  { name: "McDonald's", category: "food", avgAmount: 12 },
  { name: "Shell Gas Station", category: "fuel", avgAmount: 55 },
  { name: "Amazon", category: "retail", avgAmount: 85 },
  { name: "Walmart", category: "retail", avgAmount: 120 },
  { name: "Apple Store", category: "electronics", avgAmount: 650 },
  { name: "Best Buy", category: "electronics", avgAmount: 350 },
  { name: "Coinbase", category: "crypto", avgAmount: 2800 },
  { name: "Binance", category: "crypto", avgAmount: 4200 },
  { name: "Bellagio Casino", category: "gambling", avgAmount: 1500 },
  { name: "DraftKings", category: "gambling", avgAmount: 400 },
  { name: "Western Union", category: "wire_transfer", avgAmount: 8000 },
  { name: "MoneyGram", category: "wire_transfer", avgAmount: 6500 },
  { name: "Tiffany & Co.", category: "jewelry", avgAmount: 2200 },
  { name: "Netflix", category: "entertainment", avgAmount: 18 },
  { name: "Uber", category: "transportation", avgAmount: 22 },
  { name: "CVS Pharmacy", category: "healthcare", avgAmount: 45 },
  { name: "Delta Airlines", category: "travel", avgAmount: 380 },
  { name: "Marriott Hotels", category: "travel", avgAmount: 250 },
  { name: "Target", category: "retail", avgAmount: 75 },
];

const LOCATIONS = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Miami, FL",
  "Houston, TX",
  "London, UK",
  "Tokyo, JP",
  "Dubai, UAE",
  "Toronto, CA",
  "Sydney, AU",
  "Singapore, SG",
  "Amsterdam, NL",
];

let txCounter = 100000;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateTransaction() {
  const merchant = pick(MERCHANTS);
  const location = pick(LOCATIONS);
  const userId = Math.floor(Math.random() * 6) + 1;

  // Occasionally spike the amount to trigger high fraud scores
  const spike = Math.random() < 0.15;
  const amount = spike
    ? randomBetween(merchant.avgAmount * 5, merchant.avgAmount * 20)
    : randomBetween(merchant.avgAmount * 0.5, merchant.avgAmount * 2.5);

  const roundedAmount = Math.round(amount * 100) / 100;

  // Simulate varying user history
  const userTransactionCount = Math.floor(randomBetween(5, 120));
  const userAvgAmount = randomBetween(30, 500);
  const userUniqueLocations = Math.floor(randomBetween(1, 10));
  const userUniqueDevices = Math.floor(randomBetween(1, 5));
  const userFlaggedCount = Math.random() < 0.2 ? Math.floor(randomBetween(1, 8)) : 0;

  const result = analyzeFraud({
    amount: roundedAmount,
    userId,
    location,
    merchantCategory: merchant.category,
    deviceId: `device-sim-${Math.floor(Math.random() * 20)}`,
    userTransactionCount,
    userAvgAmount,
    userUniqueLocations,
    userUniqueDevices,
    userFlaggedCount,
  });

  const id = `sim-${++txCounter}`;

  return {
    id,
    merchantName: merchant.name,
    merchantCategory: merchant.category,
    amount: roundedAmount,
    location,
    userId,
    fraudScore: result.fraudScore,
    anomalyScore: result.anomalyScore,
    riskLevel: result.riskLevel,
    status: result.status,
    reason: result.reason,
    severity: result.severity,
    simulated: true,
  };
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startTransactionSimulator(intervalMs = 3000): void {
  if (interval) return;

  logger.info({ intervalMs }, "Starting transaction simulator");

  interval = setInterval(() => {
    const tx = generateTransaction();
    broadcastTransaction(tx);

    if (tx.status === "flagged" || tx.status === "blocked") {
      broadcastAlert({
        id: `alert-${tx.id}`,
        transactionId: tx.id,
        merchantName: tx.merchantName,
        amount: tx.amount,
        location: tx.location,
        severity: tx.severity,
        reason: tx.reason,
        status: tx.status,
        riskLevel: tx.riskLevel,
        simulated: true,
      });
    }
  }, intervalMs);
}

export function stopTransactionSimulator(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
