import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  ClaimDonationParams,
  CreateDonationBody,
  CreateDonationResponse,
  DemoLoginBody,
  DemoLoginResponse,
  GetCurrentUserResponse,
  GetDashboardSummaryResponse,
  GetDonationParams,
  GetDonationResponse,
  GetRecentActivityResponse,
  ListDonationsQueryParams,
  ListDonationsResponse,
  ListNearbyOrganizationsResponse,
  ListNotificationsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  UpdateDonationBody,
  UpdateDonationParams,
  UpdateDonationResponse,
  UpdateDonationStatusBody,
  UpdateDonationStatusParams,
  UpdateDonationStatusResponse,
} from "@workspace/api-zod";
import {
  donations,
  makeDonation,
  notificationsByRole,
  organizations,
  refreshExpiry,
  userForRole,
} from "../lib/foodrescue-store";
import { getAuth } from "@clerk/express";
import {
  createDemoToken,
  getDemoRole,
  getDemoTokenRole,
  hasValidDemoToken,
  setClerkRole,
} from "../lib/demo-auth";

const router: IRouter = Router();

function fail(res: Parameters<Parameters<IRouter["get"]>[1]>[1], status: number, error: string) {
  res.status(status).json({ error });
}

router.post("/auth/demo-login", (req, res) => {
  const input = DemoLoginBody.parse(req.body);
  const user = userForRole(input.role);
  const response = DemoLoginResponse.parse({ token: createDemoToken(input.role), user });
  res.json(response);
});

function requireAppAuth(req: Request, res: Response, next: NextFunction) {
  if (getAuth(req).userId || hasValidDemoToken(req)) return next();
  return fail(res, 401, "Authentication required.");
}

router.use(requireAppAuth);

router.get("/auth/me", (req, res) => {
  res.json(GetCurrentUserResponse.parse(userForRole(getDemoRole(req))));
});

router.post("/auth/role", (req, res) => {
  const role = req.body?.role;
  if (role !== "restaurant" && role !== "organization" && role !== "admin") {
    return fail(res, 400, "Choose a valid workspace role.");
  }
  if (!getAuth(req).userId) return fail(res, 401, "Authentication required.");
  setClerkRole(req, role);
  return res.json(GetCurrentUserResponse.parse(userForRole(role)));
});

router.get("/donations", (req, res) => {
  refreshExpiry();
  const query = ListDonationsQueryParams.parse(req.query);
  const normalizedSearch = query.search?.toLowerCase();
  const result = donations.filter((donation) => {
    if (query.status && donation.status !== query.status) return false;
    if (query.foodType && donation.foodType !== query.foodType) return false;
    if (query.category && donation.category !== query.category) return false;
    if (query.urgent !== undefined && donation.urgent !== query.urgent) return false;
    if (
      normalizedSearch &&
      !`${donation.foodName} ${donation.restaurantName} ${donation.category}`.toLowerCase().includes(normalizedSearch)
    ) {
      return false;
    }
    return true;
  });
  res.json(ListDonationsResponse.parse(result));
});

router.post("/donations", (req, res) => {
  if (getDemoRole(req) !== "restaurant") return fail(res, 403, "Only restaurant accounts can post food.");
  const input = CreateDonationBody.parse(req.body);
  const donation = makeDonation(input);
  res.status(201).json(CreateDonationResponse.parse(donation));
});

router.get("/donations/:id", (req, res) => {
  refreshExpiry();
  const params = GetDonationParams.parse(req.params);
  const donation = donations.find((item) => item.id === params.id);
  if (!donation) return fail(res, 404, "Donation not found.");
  return res.json(GetDonationResponse.parse(donation));
});

router.patch("/donations/:id", (req, res) => {
  const params = UpdateDonationParams.parse(req.params);
  const input = UpdateDonationBody.parse(req.body);
  const donation = donations.find((item) => item.id === params.id);
  if (!donation) return fail(res, 404, "Donation not found.");
  if (input.status) donation.status = input.status;
  if (input.description) donation.description = input.description;
  return res.json(UpdateDonationResponse.parse(donation));
});

router.post("/donations/:id/claim", (req, res) => {
  refreshExpiry();
  if (getDemoRole(req) !== "organization") return fail(res, 403, "Only organization accounts can claim food.");
  const params = ClaimDonationParams.parse(req.params);
  const donation = donations.find((item) => item.id === params.id);
  if (!donation) return fail(res, 404, "Donation not found.");
  if (donation.status !== "AVAILABLE") return fail(res, 409, "This donation is no longer available.");
  donation.status = "CLAIMED";
  donation.claimedByName = userForRole("organization").organizationName;
  notificationsByRole.restaurant.unshift({
    id: `notification-${Date.now()}`,
    title: "Donation claimed",
    message: `${donation.claimedByName} claimed your ${donation.foodName}.`,
    type: "claim",
    isRead: false,
    relatedDonationId: donation.id,
    createdAt: new Date().toISOString(),
  });
  return res.json(CreateDonationResponse.parse(donation));
});

router.patch("/donations/:id/status", (req, res) => {
  const params = UpdateDonationStatusParams.parse(req.params);
  const input = UpdateDonationStatusBody.parse(req.body);
  const donation = donations.find((item) => item.id === params.id);
  if (!donation) return fail(res, 404, "Donation not found.");
  donation.status = input.status;
  return res.json(UpdateDonationStatusResponse.parse(donation));
});

router.get("/dashboard/summary", (_req, res) => {
  refreshExpiry();
  const completed = donations.filter((donation) => donation.status === "COMPLETED");
  const active = donations.filter((donation) =>
    ["AVAILABLE", "CLAIMED", "PICKUP_PENDING", "PICKED_UP", "DELIVERED"].includes(donation.status),
  );
  const response = {
    totalDonations: donations.length + 209,
    activeDonations: active.length,
    completedDonations: completed.length + 214,
    foodRescuedKg: completed.reduce((total, donation) => total + Number.parseFloat(donation.quantity), 0) + 1240,
    mealsServed: completed.reduce((total, donation) => total + donation.servings, 0) + 3850,
    organizationsHelped: 38,
    restaurantsParticipating: 67,
    completionRate: 91.4,
    monthlyDonations: [
      { month: "Mar", value: 38 },
      { month: "Apr", value: 52 },
      { month: "May", value: 64 },
      { month: "Jun", value: 78 },
      { month: "Jul", value: 91 },
      { month: "Aug", value: 116 },
    ],
    monthlyImpact: [
      { month: "Mar", value: 420 },
      { month: "Apr", value: 610 },
      { month: "May", value: 780 },
      { month: "Jun", value: 950 },
      { month: "Jul", value: 1120 },
      { month: "Aug", value: 1240 },
    ],
  };
  res.json(GetDashboardSummaryResponse.parse(response));
});

router.get("/dashboard/activity", (_req, res) => {
  const activity = [
    { id: "activity-1", title: "Sahara Community Kitchen received a rescue", description: "64 meals from Monsoon Table were completed.", time: "18 min ago", tone: "green" },
    { id: "activity-2", title: "A new urgent donation is nearby", description: "48 servings of vegetable biryani need pickup soon.", time: "34 min ago", tone: "amber" },
    { id: "activity-3", title: "Udaan Children's Home joined FoodRescue", description: "The organization was verified by the operations team.", time: "2 hr ago", tone: "blue" },
    { id: "activity-4", title: "Monthly impact milestone reached", description: "The community crossed 1,200 kg of food rescued.", time: "Yesterday", tone: "slate" },
  ];
  res.json(GetRecentActivityResponse.parse(activity));
});

router.get("/notifications", (req, res) => {
  res.json(ListNotificationsResponse.parse(notificationsByRole[getDemoRole(req)]));
});

router.patch("/notifications/:id/read", (req, res) => {
  const params = MarkNotificationReadParams.parse(req.params);
  const notifications = notificationsByRole[getDemoRole(req)];
  const notification = notifications.find((item) => item.id === params.id);
  if (!notification) return fail(res, 404, "Notification not found.");
  notification.isRead = true;
  return res.json(MarkNotificationReadResponse.parse(notification));
});

router.get("/organizations/nearby", (_req, res) => {
  res.json(ListNearbyOrganizationsResponse.parse(organizations));
});

export default router;