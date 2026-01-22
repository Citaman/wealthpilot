import { db, type Transaction } from "./db";
import { format, subDays } from "date-fns";

const MERCHANTS = [
  "Amazon", "Uber", "Carrefour", "Starbucks", "Netflix", "Spotify", 
  "Apple", "Google", "Airbnb", "Total", "Shell", "McDonalds", 
  "Burger King", "Zara", "H&M", "IKEA", "Decathlon", "Fnac"
];

const CATEGORIES = [
  { name: "Food", sub: ["Groceries", "Restaurants", "Delivery", "Fast Food"] },
  { name: "Transport", sub: ["Fuel", "Public Transit", "Ride-hailing"] },
  { name: "Shopping", sub: ["Electronics", "Clothing", "Online"] },
  { name: "Entertainment", sub: ["Cinema", "Games", "Events"] },
  { name: "Bills", sub: ["Phone", "Internet", "Subscriptions"] },
];

export async function runStressTest(count: number = 10000, accountId: number) {
  const transactions: Omit<Transaction, "id">[] = [];
  const now = new Date();
  
  console.time("Stress Test Generation");
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const date = format(subDays(now, daysAgo), "yyyy-MM-dd");
    
    const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const sub = cat.sub[Math.floor(Math.random() * cat.sub.length)];
    const merchant = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
    
    const amount = Math.floor(Math.random() * 200) + 5; // 5 to 205
    
    transactions.push({
      date,
      valueDate: date,
      direction: "debit",
      amount: amount,
      balanceAfter: 0, // Will be recalculated
      category: cat.name,
      subcategory: sub,
      merchant,
      merchantOriginal: merchant.toUpperCase() + " FR",
      paymentMethod: "Card",
      description: `Stress test transaction ${i}`,
      isRecurring: false,
      accountId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["stress-test"],
    });
  }
  
  console.timeEnd("Stress Test Generation");
  console.time("Stress Test Insertion");
  
  // Batch insert
  await db.transactions.bulkAdd(transactions as Transaction[]);
  
  console.timeEnd("Stress Test Insertion");
  
  return transactions.length;
}

export async function clearStressTestTransactions() {
  // Delete transactions with tag 'stress-test'
  // Note: Dexie doesn't support complex queries in delete(), so we find IDs first
  const ids = await db.transactions
    .filter(t => t.tags?.includes("stress-test") ?? false)
    .primaryKeys();
    
  await db.transactions.bulkDelete(ids);
  return ids.length;
}
