import { test, expect } from "@playwright/test";

const id = "00000000-0000-4000-8000-000000000001";
const batchId = "00000000-0000-4000-8000-000000000002";
const center = {
  id,
  name: "Test Learning Center",
  address: "12 School Road",
  city: "Delhi",
  locality: "Rohini",
  subject: "Mathematics",
  class_level: "10",
  board: "CBSE",
  monthly_fee: "1800",
  mode: "offline",
  vacant_seats: 4,
  average_rating: "4.5",
  total_reviews: 2,
  batch_id: batchId,
  start_time: "17:00:00",
  end_time: "18:00:00",
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      json: { success: false, error: "Authentication required" },
    }),
  );
});

test("homepage fits mobile, tablet and desktop; navigation and FAQ work", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.getByText("Can parents book a demo?").click();
  await expect(page.getByText("Yes. Create a parent account")).toBeVisible();
});

test("search forwards filters and displays actual result fields", async ({
  page,
}) => {
  let query: URL | undefined;
  await page.route("**/api/search/centers?*", (route) => {
    query = new URL(route.request().url());
    return route.fulfill({ json: { success: true, data: [center] } });
  });
  await page.goto("/");
  await page.getByLabel("WHERE ARE YOU?", { exact: false }).fill("Delhi");
  await page.getByLabel("YOUR CLASS", { exact: false }).selectOption("10");
  await page.getByLabel("YOUR SUBJECT", { exact: false }).fill("Mathematics");
  await page.getByRole("button", { name: "Find my tuition" }).click();
  await expect(page.getByRole("heading", { name: center.name })).toBeVisible();
  expect(query?.searchParams.get("city")).toBe("Delhi");
  expect(query?.searchParams.get("classLevel")).toBe("10");
  await page.getByLabel("Learning mode").selectOption("offline");
  await page.getByLabel("Monthly budget").fill("2000");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("heading", { name: center.name })).toBeVisible();
  expect(query?.searchParams.get("maxFee")).toBe("2000");
  expect(query?.searchParams.get("mode")).toBe("offline");
  await page.getByRole("link", { name: "Meet your tuition" }).click();
  await expect(page).toHaveURL(new RegExp(`/centers/${id}`));
});

test("search failure can retry into an honest empty state", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/search/centers?*", (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { success: false, error: "Unavailable" } }
        : { json: { success: true, data: [] } },
    ),
  );
  await page.goto("/search");
  await expect(
    page.getByRole("heading", { name: "Let’s try that again" }),
  ).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(
    page.getByRole("heading", { name: "A little wider might do it." }),
  ).toBeVisible();
});

test("center supports saving and booking with correct API payloads", async ({
  page,
}) => {
  let booking: Record<string, string> | undefined;
  await page.route(`**/api/centers/${id}`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          ...center,
          description: "A test center.",
          teachers: [],
          reviews: [],
          videos: [],
          batches: [
            {
              ...center,
              id: batchId,
              batch_name: "Evening Maths",
              teacher_name: "Test Teacher",
              days_of_week: ["Monday", "Wednesday"],
            },
          ],
        },
      },
    }),
  );
  await page.route("**/api/shortlists", (route) => {
    expect(route.request().postDataJSON()).toEqual({ centerId: id });
    return route.fulfill({ json: { success: true, data: {} } });
  });
  await page.route("**/api/demo-bookings", (route) => {
    booking = route.request().postDataJSON();
    return route.fulfill({ json: { success: true, data: { id: "booking" } } });
  });
  await page.goto(`/centers/${id}`);
  await page.getByRole("button", { name: "Save this center" }).click();
  await expect(
    page.getByRole("button", { name: "Saved", exact: false }),
  ).toBeDisabled();
  await page.getByLabel("Preferred date & time").fill("2030-10-20T17:00");
  await page.getByLabel("Contact phone").fill("9876543210");
  await page.getByRole("button", { name: "Book my demo" }).click();
  await expect(
    page.getByText("Your demo is booked!", { exact: false }),
  ).toBeVisible();
  expect(booking?.centerId).toBe(id);
  expect(booking?.batchId).toBe(batchId);
  expect(booking?.contactPhone).toBe("9876543210");
  expect(new Date(booking!.bookingTime).getFullYear()).toBe(2030);
});

test("login reports invalid credentials and safely returns to the requested page", async ({
  page,
}) => {
  let accepted = false;
  await page.route("**/api/auth/login", (route) =>
    route.fulfill(
      accepted
        ? { json: { success: true, data: {} } }
        : {
            status: 401,
            json: { success: false, error: "Invalid credentials" },
          },
    ),
  );
  await page.goto("/login?next=/search");
  await page.getByLabel("Email address").fill("student@example.com");
  await page.getByLabel("Password", { exact: true }).fill("testpassword");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Invalid credentials",
  );
  accepted = true;
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/search$/);
});

test("saved centers use the API center id and can be removed", async ({
  page,
}) => {
  await page.route("**/api/demo-bookings?*", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  await page.route("**/api/shortlists?*", (route) =>
    route.fulfill({ json: { success: true, data: [center] } }),
  );
  await page.route(`**/api/shortlists/${id}`, (route) => {
    expect(route.request().method()).toBe("DELETE");
    return route.fulfill({ json: { success: true, data: { removed: true } } });
  });
  await page.goto("/my-learning");
  await page.getByRole("button", { name: "Saved centers (1)" }).click();
  await expect(
    page.getByRole("link", { name: "Explore center" }),
  ).toHaveAttribute("href", `/centers/${id}`);
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make a little shortlist." }),
  ).toBeVisible();
});
