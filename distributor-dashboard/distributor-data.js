/**
 * Static reference data for Distributor Churn Intelligence.
 *
 * All of it is synthetic. The distributor sells disposables and jan-san
 * directly to operators, so every number here stands in for invoice data the
 * distributor already owns — no claims, no reporting lag.
 *
 * Each roster row carries `signals`: the buying story that operator is meant
 * to tell. The generator in distributor-model.js turns those into invoice
 * lines, so the charts, the risk drivers and the written explanation always
 * agree with one another.
 *
 * Exposed as window.DistData; loaded before the dashboard's own script.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DistData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Snapshot date every date calculation is measured from. Never wall-clock today. */
  const SNAPSHOT_AS_OF = '2026-09-30';
  /**
   * Data freshness, shown separately as the blueprint requires: the latest
   * invoice date received, and when risk was scored. Timely invoice
   * visibility does not mean a daily feed — the refresh schedule is each
   * distributor's own, so the UI states dates rather than a cadence.
   */
  const FRESHNESS = { snapshot: 'Sep 2026', invoicesThrough: '2026-09-29', scoredOn: '2026-09-30' };

  const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  /** List price sits this far above the base sell price; discount = 1 − sell / list. */
  const LIST_MARKUP = 1.28;

  const MANUFACTURERS = {
    GP: { name: 'Georgia-Pacific', color: '#3E4A7A' },
    KC: { name: 'Kimberly-Clark', color: '#5F8FC0' },
    DART: { name: 'Dart', color: '#C9773E' },
    PACTIV: { name: 'Pactiv', color: '#2E8A6E' },
    HUHT: { name: 'Huhtamaki', color: '#8E6BB0' },
    ECO: { name: 'Eco-Products', color: '#7FA34A' },
    ESSITY: { name: 'Essity (Tork)', color: '#B0506A' },
    BERRY: { name: 'Berry Global', color: '#4F9DA6' },
    INTEPLAST: { name: 'Inteplast', color: '#A3977F' },
    REYNOLDS: { name: 'Reynolds', color: '#6B5F8E' },
  };

  /**
   * One SKU per manufacturer per category.
   *   price  base sell price per case — shared by every operator, so peers and
   *          months stay comparable; each operator's position is applied on top
   *   cost   distributor landed cost as a share of that price
   *   tier   premium / standard / value — what "buying cheaper" moves between
   */
  const sku = (mfr, name, price, cost, tier) => ({ mfr, name, price, cost, tier });

  const CATEGORIES = {
    'Plates & Bowls': [
      sku('GP', 'GP 10" heavy paper plate 500ct', 58.4, 0.74, 'premium'),
      sku('HUHT', 'Huhtamaki 10" molded fiber plate 500ct', 54.9, 0.76, 'standard'),
      sku('DART', 'Dart 10" foam plate 500ct', 36.2, 0.79, 'value'),
      sku('PACTIV', 'Pactiv 9" clear bowl 300ct', 47.5, 0.77, 'standard'),
    ],
    'Cups & Lids': [
      sku('DART', 'Dart 16oz foam cup 1000ct', 52.1, 0.75, 'standard'),
      sku('GP', 'GP 16oz hot cup 1000ct', 71.8, 0.73, 'premium'),
      sku('PACTIV', 'Pactiv 16oz PET cold cup 1000ct', 64.3, 0.76, 'standard'),
      sku('ECO', 'Eco-Products 16oz compostable cup 1000ct', 88.6, 0.71, 'premium'),
    ],
    'Take-out Containers': [
      sku('PACTIV', 'Pactiv 9" hinged container 200ct', 61.2, 0.74, 'standard'),
      sku('DART', 'Dart 9" foam hinged 200ct', 39.8, 0.80, 'value'),
      sku('ECO', 'Eco-Products 9" fiber clamshell 200ct', 79.5, 0.72, 'premium'),
    ],
    'Cutlery': [
      sku('DART', 'Dart heavy PS cutlery kit 250ct', 34.6, 0.77, 'standard'),
      sku('GP', 'GP SmartStock fork refill 960ct', 49.2, 0.72, 'premium'),
      sku('ECO', 'Eco-Products CPLA fork 1000ct', 56.8, 0.73, 'premium'),
    ],
    'Napkins': [
      sku('GP', 'GP dinner napkin 3000ct', 44.7, 0.74, 'standard'),
      sku('KC', 'Kimberly-Clark dispenser napkin 6000ct', 52.3, 0.73, 'premium'),
      sku('ESSITY', 'Tork Xpressnap 6000ct', 57.9, 0.72, 'premium'),
    ],
    'Towels & Tissue': [
      sku('GP', 'GP enMotion roll towel 6ct', 68.5, 0.73, 'standard'),
      sku('KC', 'Kimberly-Clark Scott roll towel 6ct', 74.2, 0.72, 'premium'),
      sku('ESSITY', 'Tork Matic roll towel 6ct', 71.6, 0.73, 'premium'),
    ],
    'Can Liners': [
      sku('BERRY', 'Berry 40-45gal 1.5mil liner 100ct', 42.9, 0.75, 'standard'),
      sku('INTEPLAST', 'Inteplast 40-45gal 0.9mil liner 250ct', 31.4, 0.81, 'value'),
    ],
    'Food Wrap': [
      sku('REYNOLDS', 'Reynolds 18" foodservice foil 500ft', 38.6, 0.76, 'standard'),
      sku('PACTIV', 'Pactiv 18" film wrap 2000ft', 29.7, 0.79, 'value'),
    ],
  };

  const CATEGORY_NAMES = Object.keys(CATEGORIES);
  const CATEGORY_C = ['#3E4A7A', '#5F72B0', '#2E6F8E', '#8FA0D0', '#6E9A5B', '#C9A36A', '#7FB3C8', '#B07A5F'];

  const TYPE_CATEGORIES = {
    'QSR': ['Cups & Lids', 'Take-out Containers', 'Napkins', 'Cutlery', 'Food Wrap', 'Can Liners'],
    'Casual Dining': ['Plates & Bowls', 'Napkins', 'Take-out Containers', 'Towels & Tissue', 'Can Liners', 'Food Wrap'],
    'Healthcare': ['Plates & Bowls', 'Cups & Lids', 'Cutlery', 'Napkins', 'Towels & Tissue', 'Can Liners'],
    'Education': ['Plates & Bowls', 'Cups & Lids', 'Cutlery', 'Napkins', 'Take-out Containers', 'Can Liners'],
    'Lodging': ['Cups & Lids', 'Towels & Tissue', 'Napkins', 'Can Liners', 'Plates & Bowls', 'Food Wrap'],
  };
  const OPERATOR_TYPES = Object.keys(TYPE_CATEGORIES);

  /**
   * Normal monthly demand relative to an average month (Oct … Sep). Schools
   * close for the summer, so Jun–Aug is low every year. Trends and statuses
   * compare against this pattern, so a seasonal dip is not mistaken for churn.
   * Types not listed have no seasonal pattern.
   */
  const SEASONALITY = {
    'Education': [1.05, 1.05, 0.9, 1.05, 1.05, 1.05, 1.05, 1.0, 0.6, 0.45, 0.55, 1.05],
  };
  const BRANCHES = ['Chicago', 'Atlanta', 'Phoenix'];

  /**
   * Who should review a flagged operator, and what they should look at.
   * Chosen from the shape of the decline (distributor-logic.js → reviewTeam).
   */
  const REVIEW_TEAMS = {
    sales: { label: 'Sales', focus: 'Talk to the operator about the overall drop in ordering' },
    category: { label: 'Category team', focus: 'Look at the categories and products being dropped or replaced' },
    pricing: { label: 'Pricing', focus: 'Review recent price, discount and margin changes' },
    service: { label: 'Customer service', focus: 'Check late deliveries, credits and fill rate' },
    none: { label: 'No review needed', focus: 'Buying normally' },
  };

  /**
   * One operator per row.
   *   rev90        trailing-90-day revenue the generated invoices are scaled to
   *   prob         model risk score for the snapshot month
   *   pd           change in score vs last month, in points
   *   daysSince    days since the last invoice
   *   interval     their normal days between orders
   *   catsNow / catsPeak   categories still bought vs at their peak
   *   tenure       years as an operator
   *   signals      buying story — see distributor-model.js
   */
  const o = (id, name, type, size, city, branch, rev90, prob, pd, daysSince, interval, catsNow, catsPeak, tenure, signals) =>
    ({ id, name, type, size, city, branch, rev90, prob, pd, daysSince, interval, catsNow, catsPeak, tenure, signals });

  const ROSTER = [
    // --- Chicago branch ----------------------------------------------------------
    o('OP-10418', 'Lakeshore Burger Co', 'QSR', 'M', 'Chicago', 'Chicago', 186000, 0.91, 12, 19, 4, 4, 6, 6, ['erosion', 'switch']),
    o('OP-10422', 'Wicker Park Taqueria', 'QSR', 'S', 'Chicago', 'Chicago', 42000, 0.34, -2, 4, 5, 5, 5, 4, []),
    o('OP-10437', 'Northshore Medical Center', 'Healthcare', 'L', 'Evanston', 'Chicago', 512000, 0.78, 6, 9, 3, 5, 6, 11, ['switch', 'service']),
    o('OP-10451', 'Prairie State University', 'Education', 'L', 'Normal', 'Chicago', 438000, 0.27, -3, 3, 3, 6, 6, 9, []),
    o('OP-10466', 'Loop Hotel Group', 'Lodging', 'L', 'Chicago', 'Chicago', 344000, 0.83, 9, 12, 4, 4, 6, 7, ['category', 'price']),
    o('OP-10473', 'Fulton Market Bistro', 'Casual Dining', 'S', 'Chicago', 'Chicago', 38000, 0.62, 4, 11, 6, 5, 5, 3, ['tradedown']),
    o('OP-10489', 'Heartland Senior Living', 'Healthcare', 'M', 'Joliet', 'Chicago', 126000, 0.45, 1, 6, 5, 6, 6, 8, ['service']),
    o('OP-10495', 'Midway Wings', 'QSR', 'S', 'Chicago', 'Chicago', 29000, 0.88, 14, 26, 6, 2, 5, 2, ['erosion', 'category']),
    o('OP-10502', 'Oak Brook Country Club', 'Lodging', 'M', 'Oak Brook', 'Chicago', 98000, 0.22, -4, 4, 6, 5, 5, 12, []),
    o('OP-10517', 'Naperville School District', 'Education', 'L', 'Naperville', 'Chicago', 296000, 0.71, 5, 8, 4, 5, 6, 10, ['switch', 'tradedown']),
    o('OP-10523', 'Milwaukee Ave Diner', 'Casual Dining', 'S', 'Chicago', 'Chicago', 31000, 0.39, 0, 7, 6, 4, 4, 5, []),
    o('OP-10538', 'Great Lakes Rehab', 'Healthcare', 'M', 'Gary', 'Chicago', 142000, 0.57, 3, 7, 4, 5, 6, 6, ['price']),
    o('OP-10544', 'Rush Street Steakhouse', 'Casual Dining', 'M', 'Chicago', 'Chicago', 88000, 0.19, -5, 3, 4, 6, 6, 14, []),
    o('OP-10559', 'Lincoln Park Cafes', 'Casual Dining', 'M', 'Chicago', 'Chicago', 74000, 0.74, 7, 15, 5, 3, 5, 4, ['erosion', 'category']),
    o('OP-10561', 'Elmhurst College Dining', 'Education', 'M', 'Elmhurst', 'Chicago', 118000, 0.31, -1, 4, 4, 6, 6, 7, []),
    o('OP-10576', 'Pilsen Pizza Kitchen', 'QSR', 'S', 'Chicago', 'Chicago', 36000, 0.48, 2, 7, 5, 5, 5, 3, ['tradedown']),

    // --- Atlanta branch ----------------------------------------------------------
    o('OP-20104', 'Peachtree Medical Group', 'Healthcare', 'L', 'Atlanta', 'Atlanta', 486000, 0.86, 8, 14, 3, 4, 6, 9, ['erosion', 'category']),
    o('OP-20117', 'Buckhead Grill House', 'Casual Dining', 'M', 'Atlanta', 'Atlanta', 112000, 0.29, -3, 4, 5, 6, 6, 8, []),
    o('OP-20123', 'Georgia Tech Dining', 'Education', 'L', 'Atlanta', 'Atlanta', 402000, 0.66, 4, 6, 3, 6, 6, 6, ['switch']),
    o('OP-20138', 'Southern Fried Express', 'QSR', 'M', 'Marietta', 'Atlanta', 154000, 0.79, 6, 9, 3, 5, 6, 5, ['switch', 'price']),
    o('OP-20142', 'Savannah Harbor Resort', 'Lodging', 'L', 'Savannah', 'Atlanta', 318000, 0.41, 1, 6, 5, 6, 6, 10, ['service']),
    o('OP-20159', 'Midtown Sushi Bar', 'Casual Dining', 'S', 'Atlanta', 'Atlanta', 27000, 0.93, 15, 31, 7, 2, 4, 2, ['erosion', 'category']),
    o('OP-20161', 'Cobb County Schools', 'Education', 'L', 'Marietta', 'Atlanta', 364000, 0.24, -2, 3, 3, 6, 6, 12, []),
    o('OP-20176', 'Decatur Family Clinics', 'Healthcare', 'M', 'Decatur', 'Atlanta', 96000, 0.53, 2, 8, 5, 5, 5, 4, ['tradedown', 'price']),
    o('OP-20184', 'Biscuit Barn', 'QSR', 'S', 'Athens', 'Atlanta', 33000, 0.36, -1, 5, 5, 5, 5, 6, []),
    o('OP-20193', 'Hilton Head Inn & Suites', 'Lodging', 'M', 'Hilton Head', 'Atlanta', 86000, 0.69, 5, 12, 6, 4, 5, 5, ['price', 'service']),
    o('OP-20207', 'Emory Hillside Hospital', 'Healthcare', 'L', 'Atlanta', 'Atlanta', 548000, 0.21, -4, 2, 2, 6, 6, 15, []),
    o('OP-20212', 'Ponce City Kitchens', 'Casual Dining', 'M', 'Atlanta', 'Atlanta', 92000, 0.58, 3, 9, 5, 6, 6, 4, ['switch']),
    o('OP-20228', 'Chick-n-Go Augusta', 'QSR', 'M', 'Augusta', 'Atlanta', 138000, 0.32, -2, 4, 3, 6, 6, 7, []),
    o('OP-20235', 'Macon Community College', 'Education', 'M', 'Macon', 'Atlanta', 104000, 0.76, 6, 11, 4, 4, 6, 6, ['erosion', 'switch']),
    o('OP-20241', 'Lowcountry Seafood Shack', 'Casual Dining', 'S', 'Charleston', 'Atlanta', 41000, 0.44, 1, 7, 6, 5, 5, 3, ['tradedown']),
    o('OP-20256', 'Alpharetta Assisted Living', 'Healthcare', 'M', 'Alpharetta', 'Atlanta', 118000, 0.26, -3, 5, 5, 6, 6, 9, []),

    // --- Phoenix branch ----------------------------------------------------------
    o('OP-30109', 'Desert Sun Resorts', 'Lodging', 'L', 'Scottsdale', 'Phoenix', 402000, 0.81, 7, 10, 3, 5, 6, 8, ['switch', 'price']),
    o('OP-30114', 'Camelback Taco Co', 'QSR', 'S', 'Phoenix', 'Phoenix', 38000, 0.27, -3, 4, 5, 5, 5, 5, []),
    o('OP-30128', 'Banner Valley Hospital', 'Healthcare', 'L', 'Mesa', 'Phoenix', 524000, 0.47, 2, 4, 2, 6, 6, 13, ['service']),
    o('OP-30133', 'Tempe Unified Schools', 'Education', 'L', 'Tempe', 'Phoenix', 286000, 0.84, 9, 13, 3, 4, 6, 8, ['erosion', 'category']),
    o('OP-30147', 'Old Town Cantina', 'Casual Dining', 'M', 'Scottsdale', 'Phoenix', 82000, 0.38, 0, 6, 5, 5, 5, 6, []),
    o('OP-30152', 'Sonoran Burger Bar', 'QSR', 'M', 'Glendale', 'Phoenix', 128000, 0.72, 5, 8, 3, 5, 6, 4, ['tradedown', 'switch']),
    o('OP-30168', 'Tucson Desert Clinic', 'Healthcare', 'S', 'Tucson', 'Phoenix', 46000, 0.63, 4, 13, 7, 4, 5, 3, ['erosion']),
    o('OP-30171', 'Grand Canyon Lodge', 'Lodging', 'M', 'Flagstaff', 'Phoenix', 94000, 0.18, -4, 5, 6, 5, 5, 11, []),
    o('OP-30186', 'Arizona State Dining', 'Education', 'L', 'Tempe', 'Phoenix', 468000, 0.35, -1, 3, 2, 6, 6, 10, []),
    o('OP-30194', 'Chandler Pho House', 'Casual Dining', 'S', 'Chandler', 'Phoenix', 29000, 0.87, 11, 24, 6, 2, 4, 2, ['erosion', 'category']),
    o('OP-30205', 'Mesa Fry Shack', 'QSR', 'S', 'Mesa', 'Phoenix', 34000, 0.51, 3, 8, 5, 5, 5, 3, ['price']),
    o('OP-30213', 'Sedona Spa Retreat', 'Lodging', 'S', 'Sedona', 'Phoenix', 44000, 0.42, 1, 9, 7, 5, 5, 6, ['service']),
    o('OP-30228', 'Gilbert Pediatric Care', 'Healthcare', 'S', 'Gilbert', 'Phoenix', 39000, 0.23, -2, 5, 6, 5, 5, 7, []),
    o('OP-30236', 'Phoenix Convention Catering', 'Casual Dining', 'L', 'Phoenix', 'Phoenix', 286000, 0.68, 5, 7, 3, 6, 6, 9, ['switch', 'tradedown']),
    o('OP-30249', 'Flagstaff Unified', 'Education', 'M', 'Flagstaff', 'Phoenix', 92000, 0.29, -2, 5, 4, 6, 6, 8, []),
    o('OP-30252', 'Yuma Wing Stop', 'QSR', 'S', 'Yuma', 'Phoenix', 26000, 0.55, 3, 10, 5, 4, 5, 2, ['erosion']),

    // --- Steady operators, so the sample resembles a real book (about one in
    // three flagged) rather than a list of problem accounts. Schools here also
    // show the normal summer dip, which must not read as churn.
    o('OP-10601', 'Wrigleyville Hot Dogs', 'QSR', 'S', 'Chicago', 'Chicago', 34000, 0.21, -1, 4, 5, 5, 5, 6, []),
    o('OP-10612', 'Hyde Park Academy', 'Education', 'M', 'Chicago', 'Chicago', 108000, 0.24, -2, 9, 4, 6, 6, 9, []),
    o('OP-10623', 'Logan Square Brewpub', 'Casual Dining', 'M', 'Chicago', 'Chicago', 76000, 0.27, 0, 5, 5, 5, 5, 5, []),
    o('OP-10634', 'Evanston Memorial Care', 'Healthcare', 'M', 'Evanston', 'Chicago', 132000, 0.19, -3, 4, 4, 6, 6, 11, []),
    o('OP-10645', 'Lakeview Suites', 'Lodging', 'M', 'Chicago', 'Chicago', 88000, 0.23, -1, 5, 6, 5, 5, 7, []),
    o('OP-10656', 'Schaumburg School District', 'Education', 'L', 'Schaumburg', 'Chicago', 322000, 0.17, -2, 12, 3, 6, 6, 13, []),
    o('OP-10667', 'Andersonville Deli', 'QSR', 'S', 'Chicago', 'Chicago', 29000, 0.33, 1, 6, 6, 4, 4, 3, []),
    o('OP-10678', 'Oak Park Family Clinic', 'Healthcare', 'S', 'Oak Park', 'Chicago', 41000, 0.26, -1, 6, 6, 5, 5, 6, []),
    o('OP-10689', 'River North Steak & Oyster', 'Casual Dining', 'L', 'Chicago', 'Chicago', 212000, 0.14, -2, 3, 3, 6, 6, 12, []),
    o('OP-10690', 'O\'Hare Airport Hotel', 'Lodging', 'L', 'Rosemont', 'Chicago', 296000, 0.18, -2, 3, 3, 6, 6, 10, []),
    o('OP-10701', 'Joliet Junior College', 'Education', 'M', 'Joliet', 'Chicago', 96000, 0.29, 0, 10, 4, 6, 6, 8, []),
    o('OP-10712', 'Bridgeport Burger Bar', 'QSR', 'S', 'Chicago', 'Chicago', 31000, 0.36, 2, 6, 5, 5, 5, 4, []),
    o('OP-10723', 'Skokie Senior Residences', 'Healthcare', 'M', 'Skokie', 'Chicago', 104000, 0.22, -1, 5, 5, 6, 6, 9, []),
    o('OP-20301', 'Midtown Taco Garage', 'QSR', 'S', 'Atlanta', 'Atlanta', 36000, 0.28, 0, 5, 5, 5, 5, 5, []),
    o('OP-20312', 'Fulton County Schools', 'Education', 'L', 'Atlanta', 'Atlanta', 412000, 0.16, -3, 11, 3, 6, 6, 14, []),
    o('OP-20323', 'Inman Park Kitchen', 'Casual Dining', 'M', 'Atlanta', 'Atlanta', 84000, 0.25, -1, 5, 5, 5, 5, 6, []),
    o('OP-20334', 'Piedmont Heart Clinics', 'Healthcare', 'L', 'Atlanta', 'Atlanta', 388000, 0.15, -2, 2, 2, 6, 6, 12, []),
    o('OP-20345', 'Stone Mountain Lodge', 'Lodging', 'M', 'Stone Mountain', 'Atlanta', 92000, 0.3, 1, 6, 6, 5, 5, 7, []),
    o('OP-20356', 'Savannah College Dining', 'Education', 'M', 'Savannah', 'Atlanta', 112000, 0.22, -1, 10, 4, 6, 6, 9, []),
    o('OP-20367', 'Augusta Wing House', 'QSR', 'S', 'Augusta', 'Atlanta', 27000, 0.34, 1, 6, 5, 4, 4, 3, []),
    o('OP-20378', 'Roswell Rehab Center', 'Healthcare', 'M', 'Roswell', 'Atlanta', 98000, 0.2, -2, 4, 4, 6, 6, 10, []),
    o('OP-20389', 'Charleston Harbor Inn', 'Lodging', 'L', 'Charleston', 'Atlanta', 264000, 0.19, -1, 4, 4, 6, 6, 11, []),
    o('OP-20390', 'Athens Southern Table', 'Casual Dining', 'S', 'Athens', 'Atlanta', 39000, 0.31, 0, 7, 6, 5, 5, 4, []),
    o('OP-20401', 'Gwinnett Tech College', 'Education', 'L', 'Lawrenceville', 'Atlanta', 268000, 0.2, -2, 12, 3, 6, 6, 10, []),
    o('OP-20412', 'Macon Medical Partners', 'Healthcare', 'S', 'Macon', 'Atlanta', 44000, 0.27, 0, 6, 6, 5, 5, 5, []),
    o('OP-20423', 'Decatur Pizza Co', 'QSR', 'M', 'Decatur', 'Atlanta', 86000, 0.24, -1, 4, 4, 5, 5, 6, []),
    o('OP-20434', 'Peachtree City Grill', 'Casual Dining', 'M', 'Peachtree City', 'Atlanta', 72000, 0.29, 0, 6, 5, 5, 5, 5, []),
    o('OP-30301', 'Scottsdale Fry Bread Co', 'QSR', 'S', 'Scottsdale', 'Phoenix', 33000, 0.3, 0, 5, 5, 5, 5, 4, []),
    o('OP-30312', 'Mesa Public Schools', 'Education', 'L', 'Mesa', 'Phoenix', 376000, 0.18, -2, 11, 3, 6, 6, 12, []),
    o('OP-30323', 'Tempe Town Lake Grill', 'Casual Dining', 'M', 'Tempe', 'Phoenix', 78000, 0.26, -1, 5, 5, 5, 5, 6, []),
    o('OP-30334', 'HonorHealth North Clinic', 'Healthcare', 'L', 'Scottsdale', 'Phoenix', 402000, 0.16, -2, 2, 2, 6, 6, 11, []),
    o('OP-30345', 'Camelback Inn Resort', 'Lodging', 'L', 'Scottsdale', 'Phoenix', 318000, 0.2, -1, 3, 3, 6, 6, 13, []),
    o('OP-30356', 'Glendale Community College', 'Education', 'M', 'Glendale', 'Phoenix', 94000, 0.25, -1, 10, 4, 6, 6, 8, []),
    o('OP-30367', 'Tucson Tamale Kitchen', 'QSR', 'S', 'Tucson', 'Phoenix', 28000, 0.35, 2, 7, 6, 4, 4, 3, []),
    o('OP-30378', 'Chandler Senior Village', 'Healthcare', 'M', 'Chandler', 'Phoenix', 102000, 0.21, -1, 5, 5, 6, 6, 9, []),
    o('OP-30389', 'Prescott Pines Lodge', 'Lodging', 'S', 'Prescott', 'Phoenix', 42000, 0.28, 0, 7, 7, 5, 5, 6, []),
    o('OP-30390', 'Gilbert Smokehouse', 'Casual Dining', 'M', 'Gilbert', 'Phoenix', 81000, 0.23, -1, 5, 5, 5, 5, 7, []),
    o('OP-30401', 'Northern Arizona University Dining', 'Education', 'L', 'Flagstaff', 'Phoenix', 352000, 0.19, -2, 12, 3, 6, 6, 11, []),
    o('OP-30412', 'Phoenix Children\'s Outpatient', 'Healthcare', 'M', 'Phoenix', 'Phoenix', 118000, 0.17, -2, 4, 4, 6, 6, 10, []),
    o('OP-30423', 'Peoria Sports Grill', 'Casual Dining', 'S', 'Peoria', 'Phoenix', 37000, 0.32, 1, 6, 6, 4, 4, 4, []),
  ];

  /**
   * Book-level aggregates for the Overview tab. The roster above is a sample;
   * these describe the whole distributor book and are not derived from it.
   */
  const BOOK = {
    operators: { cur: 8400, last: 8520 },
    tiers: { high: { S: 520, M: 160, L: 40 }, medium: { S: 1450, M: 520, L: 130 }, low: { S: 3600, M: 1450, L: 530 } },
    revenue: { cur: [14.2, 43.8, 172.5], last: [14.6, 44.9, 170.1] }, // $M, last 30 / 90 / 365 days
    segRevShare: { S: 0.22, M: 0.34, L: 0.44 },
    // Monthly history for the trend panel: revenue at risk ($M per quarter) and operators lost.
    trend: {
      months: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
      revAtRisk: [6.1, 6.4, 6.2, 7.0, 7.6, 8.3],
      lost: [38, 41, 36, 44, 52, 57],
    },
    baseRate: 0.30, // book-wide average risk score — the starting point for driver attribution
  };

  /** Simulated model diagnostics for the Model Health tab. */
  const MODEL = {
    version: 'operator-erosion v0.3 (simulated)',
    label: 'Revenue in the next 90 days below 60% of the trailing 90 days, or no invoice at all',
    trainedThrough: 'Jun 2026',
    metrics: { auc: 0.86, precisionHigh: 0.74, recallHigh: 0.61, brier: 0.112 },
    backtest: [
      // month scored, flagged High, eroded within 90 days, total eroded in book
      { month: 'Mar 2026', flagged: 640, hit: 462, eroded: 760 },
      { month: 'Apr 2026', flagged: 655, hit: 481, eroded: 790 },
      { month: 'May 2026', flagged: 690, hit: 505, eroded: 815 },
      { month: 'Jun 2026', flagged: 702, hit: 516, eroded: 842 },
    ],
    drift: [
      // population stability index, last month vs training window
      { feature: 'Order frequency', psi: 0.04 },
      { feature: 'Revenue trend (3 mo)', psi: 0.06 },
      { feature: 'Product switching', psi: 0.13 },
      { feature: 'Cheaper-product share', psi: 0.09 },
      { feature: 'Sell price change', psi: 0.21 },
      { feature: 'Late delivery rate', psi: 0.05 },
    ],
    feedback: { useful: 142, notRight: 23 },
  };

  return {
    SNAPSHOT_AS_OF, FRESHNESS, MONTHS, LIST_MARKUP,
    MANUFACTURERS, CATEGORIES, CATEGORY_NAMES, CATEGORY_C, TYPE_CATEGORIES, OPERATOR_TYPES, BRANCHES,
    SEASONALITY, REVIEW_TEAMS, ROSTER, BOOK, MODEL,
  };
});
