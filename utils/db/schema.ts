import { integer, varchar, pgTable, serial, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const Users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique(), // now nullable
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const Reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => Users.id), // nullable
  location: text("location"),
  wasteType: varchar("waste_type", { length: 255 }),
  amount: varchar("amount", { length: 255 }),
  imageUrl: text("image_url"),
  verificationResult: jsonb("verification_result"),
  status: varchar("status", { length: 255 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  collectorId: integer("collector_id").references(() => Users.id),
});

export const Rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => Users.id),
  points: integer("points").default(0),
  level: integer("level").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isAvailable: boolean("is_available").default(true),
  description: text("description"),
  name: varchar("name", { length: 255 }),
  collectionInfo: text("collection_info"),
});

export const CollectedWastes = pgTable("collected_wastes", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").references(() => Reports.id),
  collectorId: integer("collector_id").references(() => Users.id),
  collectionDate: timestamp("collection_date"),
  status: varchar("status", { length: 20 }).default("collected"),
});

export const Notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => Users.id),
  message: text("message"),
  type: varchar("type", { length: 50 }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const Transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => Users.id),
  type: varchar("type", { length: 20 }), // 'earned' or 'redeemed'
  amount: integer("amount"),
  description: text("description"),
  date: timestamp("date").defaultNow(),
});
