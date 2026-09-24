import { randomUUID } from "node:crypto";
import type { DemoRole } from "./demo-auth";

export type DonationStatus =
  | "AVAILABLE"
  | "CLAIMED"
  | "PICKUP_PENDING"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "EXPIRED"
  | "CANCELLED";

export type FoodType = "VEG" | "NON_VEG" | "VEGAN";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
  organizationName: string;
  organizationType?: string | null;
  isVerified?: boolean;
  location?: { address: string; lat: number; lng: number };
};

export type Donation = {
  id: string;
  foodName: string;
  category: string;
  quantity: string;
  servings: number;
  foodType: FoodType;
  preparationTime: string;
  expiryTime: string;
  pickupDeadline: string;
  description: string;
  imageUrl?: string | null;
  status: DonationStatus;
  restaurantName: string;
  restaurantId: string;
  claimedByName?: string | null;
  createdAt: string;
  location: { address: string; lat: number; lng: number };
  distanceKm: number;
  urgent: boolean;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  relatedDonationId?: string | null;
  createdAt: string;
};

export const users: DemoUser[] = [
  {
    id: "restaurant-1",
    name: "Aarav Mehta",
    email: "restaurant@foodrescue.demo",
    role: "restaurant",
    organizationName: "Cedar & Spice Kitchen",
    location: { address: "MP Nagar, Bhopal", lat: 23.233, lng: 77.434 },
  },
  {
    id: "organization-1",
    name: "Nisha Kapoor",
    email: "ngo@foodrescue.demo",
    role: "organization",
    organizationName: "Sahara Community Kitchen",
    organizationType: "Community kitchen",
    isVerified: true,
    location: { address: "Arera Colony, Bhopal", lat: 23.215, lng: 77.432 },
  },
  {
    id: "admin-1",
    name: "Rhea Sharma",
    email: "admin@foodrescue.demo",
    role: "admin",
    organizationName: "FoodRescue Operations",
    isVerified: true,
    location: { address: "Bhopal", lat: 23.2599, lng: 77.4126 },
  },
];

function future(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export const donations: Donation[] = [
  {
    id: "donation-1",
    foodName: "Vegetable biryani",
    category: "Cooked meals",
    quantity: "18 kg",
    servings: 48,
    foodType: "VEG",
    preparationTime: "Today, 6:30 PM",
    expiryTime: future(1.25),
    pickupDeadline: future(0.9),
    description: "Freshly prepared vegetable biryani from tonight's service. Packed in sealed, labelled containers.",
    imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80",
    status: "AVAILABLE",
    restaurantName: "Cedar & Spice Kitchen",
    restaurantId: "restaurant-1",
    createdAt: future(-1.4),
    location: { address: "MP Nagar, Bhopal", lat: 23.233, lng: 77.434 },
    distanceKm: 1.8,
    urgent: true,
  },
  {
    id: "donation-2",
    foodName: "Assorted sandwich boxes",
    category: "Bakery & snacks",
    quantity: "32 boxes",
    servings: 32,
    foodType: "VEG",
    preparationTime: "Today, 4:00 PM",
    expiryTime: future(4.5),
    pickupDeadline: future(3.75),
    description: "Individually wrapped sandwiches with fresh vegetables and cheese.",
    imageUrl: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80",
    status: "AVAILABLE",
    restaurantName: "The Daily Loaf",
    restaurantId: "restaurant-2",
    createdAt: future(-2.4),
    location: { address: "Shahpura, Bhopal", lat: 23.198, lng: 77.434 },
    distanceKm: 4.2,
    urgent: false,
  },
  {
    id: "donation-3",
    foodName: "Dal tadka and rotis",
    category: "Cooked meals",
    quantity: "14 kg",
    servings: 36,
    foodType: "VEG",
    preparationTime: "Today, 5:45 PM",
    expiryTime: future(2.8),
    pickupDeadline: future(2.25),
    description: "Comforting dal and whole-wheat rotis, packed for easy distribution.",
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80",
    status: "CLAIMED",
    restaurantName: "Green Bowl Cafe",
    restaurantId: "restaurant-3",
    claimedByName: "Sahara Community Kitchen",
    createdAt: future(-3.8),
    location: { address: "Kolar Road, Bhopal", lat: 23.165, lng: 77.411 },
    distanceKm: 6.4,
    urgent: false,
  },
  {
    id: "donation-4",
    foodName: "Fruit cups",
    category: "Produce",
    quantity: "20 cups",
    servings: 20,
    foodType: "VEGAN",
    preparationTime: "Today, 3:15 PM",
    expiryTime: future(7),
    pickupDeadline: future(6.5),
    description: "Chilled fruit cups prepared for a cancelled corporate event.",
    imageUrl: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=900&q=80",
    status: "PICKED_UP",
    restaurantName: "Lotus Events",
    restaurantId: "restaurant-4",
    claimedByName: "Sahara Community Kitchen",
    createdAt: future(-5),
    location: { address: "Hoshangabad Road, Bhopal", lat: 23.207, lng: 77.455 },
    distanceKm: 3.1,
    urgent: false,
  },
  {
    id: "donation-5",
    foodName: "Paneer curry and rice",
    category: "Cooked meals",
    quantity: "24 kg",
    servings: 64,
    foodType: "VEG",
    preparationTime: "Yesterday, 7:00 PM",
    expiryTime: future(-3),
    pickupDeadline: future(-4),
    description: "A completed rescue from last night's dinner service.",
    imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
    status: "COMPLETED",
    restaurantName: "Monsoon Table",
    restaurantId: "restaurant-5",
    claimedByName: "Sahara Community Kitchen",
    createdAt: future(-20),
    location: { address: "TT Nagar, Bhopal", lat: 23.23, lng: 77.4 },
    distanceKm: 2.7,
    urgent: false,
  },
];

export const notificationsByRole: Record<DemoRole, AppNotification[]> = {
  restaurant: [
    {
      id: "notification-r1",
      title: "Donation claimed",
      message: "Sahara Community Kitchen claimed your paneer curry and rice.",
      type: "claim",
      isRead: false,
      relatedDonationId: "donation-3",
      createdAt: future(-0.35),
    },
    {
      id: "notification-r2",
      title: "Pickup confirmed",
      message: "The fruit cups handover was confirmed and is now on its way.",
      type: "pickup",
      isRead: true,
      relatedDonationId: "donation-4",
      createdAt: future(-1.7),
    },
  ],
  organization: [
    {
      id: "notification-o1",
      title: "New nearby donation",
      message: "48 servings of vegetable biryani are available 1.8 km away.",
      type: "nearby",
      isRead: false,
      relatedDonationId: "donation-1",
      createdAt: future(-0.15),
    },
    {
      id: "notification-o2",
      title: "Pickup reminder",
      message: "Your claimed dal tadka pickup deadline is approaching.",
      type: "reminder",
      isRead: true,
      relatedDonationId: "donation-3",
      createdAt: future(-1.3),
    },
  ],
  admin: [],
};

export const organizations = [
  { id: "org-1", name: "Sahara Community Kitchen", type: "Community kitchen", address: "Arera Colony, Bhopal", peopleServed: 180, distanceKm: 1.4, isVerified: true, rating: 4.9 },
  { id: "org-2", name: "Udaan Children's Home", type: "Orphanage", address: "Bawadiya Kalan, Bhopal", peopleServed: 64, distanceKm: 3.8, isVerified: true, rating: 4.8 },
  { id: "org-3", name: "Jeevan Jyoti Shelter", type: "Shelter", address: "Ashoka Garden, Bhopal", peopleServed: 120, distanceKm: 5.2, isVerified: true, rating: 4.7 },
  { id: "org-4", name: "Aasra Old Age Home", type: "Old-age home", address: "Berasia Road, Bhopal", peopleServed: 42, distanceKm: 8.6, isVerified: true, rating: 4.9 },
];

export function userForRole(role: DemoRole) {
  return users.find((user) => user.role === role) ?? users[1];
}

export function refreshExpiry() {
  const now = Date.now();
  for (const donation of donations) {
    if (
      donation.status === "AVAILABLE" &&
      new Date(donation.expiryTime).getTime() <= now
    ) {
      donation.status = "EXPIRED";
      donation.urgent = false;
    }
    if (donation.status === "AVAILABLE") {
      const remaining = new Date(donation.expiryTime).getTime() - now;
      donation.urgent = remaining <= 2 * 60 * 60 * 1000;
    }
  }
}

export function makeDonation(input: {
  foodName: string;
  category: string;
  quantity: string;
  servings: number;
  foodType: FoodType;
  preparationTime: string;
  expiryTime: Date;
  pickupDeadline: Date;
  description: string;
  address: string;
  imageUrl?: string | null;
}) {
  const donation: Donation = {
    id: randomUUID(),
    foodName: input.foodName,
    category: input.category,
    quantity: input.quantity,
    servings: input.servings,
    foodType: input.foodType,
    preparationTime: input.preparationTime,
    expiryTime: input.expiryTime.toISOString(),
    pickupDeadline: input.pickupDeadline.toISOString(),
    description: input.description,
    imageUrl: input.imageUrl ?? null,
    status: "AVAILABLE",
    restaurantName: "Cedar & Spice Kitchen",
    restaurantId: "restaurant-1",
    claimedByName: null,
    createdAt: new Date().toISOString(),
    location: { address: input.address, lat: 23.233, lng: 77.434 },
    distanceKm: 1.8,
    urgent: input.expiryTime.getTime() - Date.now() <= 2 * 60 * 60 * 1000,
  };
  donations.unshift(donation);
  return donation;
}