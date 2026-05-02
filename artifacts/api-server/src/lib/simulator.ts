import { analyzeFraud } from "./fraud-engine";
import { broadcastTransaction, broadcastAlert } from "./websocket";
import { logger } from "./logger";

const MERCHANTS = [
  { name: "Reliance Fresh", category: "retail", avgAmount: 1200 },
  { name: "BigBasket", category: "retail", avgAmount: 950 },
  { name: "D-Mart", category: "retail", avgAmount: 1800 },
  { name: "Zomato", category: "food", avgAmount: 380 },
  { name: "Swiggy", category: "food", avgAmount: 420 },
  { name: "Blinkit", category: "food", avgAmount: 650 },
  { name: "Indian Oil", category: "fuel", avgAmount: 3200 },
  { name: "HPCL Petrol Pump", category: "fuel", avgAmount: 2800 },
  { name: "Flipkart", category: "electronics", avgAmount: 18000 },
  { name: "Croma", category: "electronics", avgAmount: 32000 },
  { name: "Vi Recharge", category: "entertainment", avgAmount: 299 },
  { name: "Hotstar Premium", category: "entertainment", avgAmount: 899 },
  { name: "CoinDCX", category: "crypto", avgAmount: 45000 },
  { name: "WazirX", category: "crypto", avgAmount: 72000 },
  { name: "CoinSwitch Kuber", category: "crypto", avgAmount: 38000 },
  { name: "Dream11", category: "gambling", avgAmount: 2500 },
  { name: "MPL Sports", category: "gambling", avgAmount: 1800 },
  { name: "Western Union India", category: "wire_transfer", avgAmount: 85000 },
  { name: "MoneyGram India", category: "wire_transfer", avgAmount: 62000 },
  { name: "Tanishq Jewellers", category: "jewelry", avgAmount: 55000 },
  { name: "Kalyan Jewellers", category: "jewelry", avgAmount: 42000 },
  { name: "Ola Cabs", category: "transportation", avgAmount: 280 },
  { name: "Rapido", category: "transportation", avgAmount: 150 },
  { name: "Apollo Pharmacy", category: "healthcare", avgAmount: 1200 },
  { name: "IndiGo Airlines", category: "travel", avgAmount: 8500 },
  { name: "MakeMyTrip", category: "travel", avgAmount: 12000 },
  { name: "OYO Rooms", category: "travel", avgAmount: 3200 },
  { name: "IRCTC", category: "travel", avgAmount: 1800 },
  { name: "Myntra", category: "retail", avgAmount: 2200 },
  { name: "Meesho", category: "retail", avgAmount: 850 },
];

const LOCATIONS = [
  "Mumbai, Maharashtra",
  "Delhi, Delhi",
  "Bengaluru, Karnataka",
  "Hyderabad, Telangana",
  "Chennai, Tamil Nadu",
  "Kolkata, West Bengal",
  "Pune, Maharashtra",
  "Ahmedabad, Gujarat",
  "Jaipur, Rajasthan",
  "Lucknow, Uttar Pradesh",
  "Surat, Gujarat",
  "Kanpur, Uttar Pradesh",
  "Nagpur, Maharashtra",
  "Indore, Madhya Pradesh",
  "Thane, Maharashtra",
  "Bhopal, Madhya Pradesh",
  "Visakhapatnam, Andhra Pradesh",
  "Pimpri-Chinchwad, Maharashtra",
  "Patna, Bihar",
  "Vadodara, Gujarat",
  "Coimbatore, Tamil Nadu",
  "Guwahati, Assam",
  "Chandigarh, Punjab",
  "Kochi, Kerala",
  "Noida, Uttar Pradesh",
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

  const spike = Math.random() < 0.15;
  const amount = spike
    ? randomBetween(merchant.avgAmount * 5, merchant.avgAmount * 20)
    : randomBetween(merchant.avgAmount * 0.5, merchant.avgAmount * 2.5);

  const roundedAmount = Math.round(amount * 100) / 100;

  const userTransactionCount = Math.floor(randomBetween(5, 120));
  const userAvgAmount = randomBetween(500, 25000);
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
