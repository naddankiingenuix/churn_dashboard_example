/**
 * Static reference data for Operator Churn Intelligence.
 *
 * All of it is synthetic. The roster is deliberately CLUSTERED rather than
 * spread evenly: peer cohorts are matched on size x type x region x metro, so
 * a uniform scatter across those four dimensions would leave almost every
 * operator with no peers to compare against.
 *
 * Exposed as window.ChurnData; loaded before the dashboard's own script.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChurnData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Snapshot date every date calculation is measured from. Never wall-clock today. */
  const SNAPSHOT_AS_OF = '2026-09-30';

  const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

  const CATALOG = {
    'Poultry': ['Chicken breast IQF 40lb', 'Chicken wings 1&2 jt 40lb', 'Turkey breast deli 2×9lb', 'Chicken tenders breaded 20lb'],
    'Beef & pork': ['Ground beef 80/20 10lb', 'Ribeye steak 12oz', 'Pulled pork cooked 2×5lb', 'Bacon slab 15lb'],
    'Seafood': ['Atlantic salmon fillet 10lb', 'Shrimp 16/20 P&D 5lb', 'Oysters shucked 1gal', 'Cod loin 10lb'],
    'Dairy & eggs': ['Shredded mozzarella 5lb', 'Heavy cream 1qt', 'Liquid eggs 20lb', 'Greek yogurt 32oz', 'Butter solids 36lb'],
    'Produce': ['Romaine hearts 48ct', 'Yellow onions 50lb', 'Avocados Hass 48ct', 'Limes 200ct', 'Mixed greens 3lb'],
    'Bakery': ['Brioche buns 4" 72ct', 'Pizza dough balls 14oz', 'Sandwich bread wheat', 'Flour tortillas 12" 72ct'],
    'Dry & canned': ['Penne rigate 20lb', 'Canola oil 35lb', 'Diced tomatoes #10', 'Long grain rice 50lb', 'Black beans #10'],
    'Frozen': ['Fries 3/8" 6×5lb', 'Mixed vegetables 12×2.5lb', 'Ice cream vanilla 3gal', 'Frozen pizza 16" 12ct'],
    'Beverages': ['Cold brew concentrate 2.5gal', 'Lemonade base 5gal', 'Orange juice 12×1qt', 'Bottled water 24ct'],
    'Disposables': ['9" hinged container 200ct', 'Nitrile gloves L 1000ct', '16oz hot cup 1000ct', 'Deli wrap 12" 1000ct'],
    'Janitorial': ['Sanitizer quat 4×1gal', 'Degreaser 4×1gal', 'Trash liners 55gal 100ct'],
    'Nutrition': ['Thickened water 48×4oz', 'Protein shake 27×8oz', 'Puréed meals 12ct'],
  };

  const LINE_NAMES = Object.keys(CATALOG);
  const LINE_C = ['#3E4A7A', '#5F72B0', '#2E6F8E', '#8FA0D0', '#6E9A5B', '#C9A36A', '#A3977F', '#7FB3C8', '#B07A5F', '#9AA0AC', '#6B5F8E', '#C2B6A0'];

  const TYPE_LINES = {
    'Casual Dining': ['Beef & pork', 'Seafood', 'Produce', 'Dairy & eggs', 'Bakery', 'Beverages', 'Poultry', 'Dry & canned'],
    'Healthcare': ['Nutrition', 'Dairy & eggs', 'Poultry', 'Produce', 'Janitorial', 'Dry & canned', 'Disposables', 'Frozen'],
    'QSR': ['Poultry', 'Beef & pork', 'Bakery', 'Frozen', 'Disposables', 'Beverages', 'Produce'],
    'Education': ['Frozen', 'Poultry', 'Dairy & eggs', 'Bakery', 'Dry & canned', 'Disposables', 'Produce', 'Beverages'],
    'Lodging': ['Dairy & eggs', 'Bakery', 'Beverages', 'Produce', 'Janitorial', 'Seafood', 'Beef & pork'],
  };

  const CUSTOMER_TYPES = Object.keys(TYPE_LINES);
  const REGIONS = ['Midwest', 'Northeast', 'South', 'West'];
  const METROS = ['Large Metro', 'Medium Metro', 'Small Metro'];

  /**
   * One operator per row.
   *   rev          trailing-90-day revenue, the "revenue at risk" figure
   *   prob         model churn probability for the snapshot month
   *   pd           change in probability vs last month, in points
   *   daysSince    days since the last order
   *   avgInterval  their normal days between orders
   *   linesNow / linesPeak   product lines still bought vs at their peak
   *   contract     master agreement id plus this operator's effective dates
   */
  const op = (id, name, seg, type, city, metro, region, rev, prob, pd, daysSince, avgInterval, linesNow, linesPeak, agreement, from, to) =>
    ({ id, name, seg, type, city, metro, region, rev, prob, pd, daysSince, avgInterval, linesNow, linesPeak, contract: { id: agreement, from, to } });

  const ROSTER = [
    // --- Medium · Casual Dining · Midwest · Large Metro ---------------------
    op('OP-10482', 'Harborview Bistro Group', 'M', 'Casual Dining', 'Chicago', 'Large Metro', 'Midwest', 412000, 0.93, 11, 48, 14, 2, 5, 'AGR-2291', '2026-01-01', '2026-12-31'),
    op('OP-40233', 'Copper Kettle Diners', 'M', 'Casual Dining', 'Detroit', 'Large Metro', 'Midwest', 305000, 0.82, 5, 18, 10, 3, 5, 'AGR-2291', '2026-01-01', '2026-12-31'),
    op('OP-51107', 'Cedar Tap House', 'M', 'Casual Dining', 'Milwaukee', 'Large Metro', 'Midwest', 356000, 0.41, -3, 9, 12, 5, 5, 'AGR-2291', '2026-03-01', '2027-02-28'),
    op('OP-51223', 'Monroe Street Grill', 'M', 'Casual Dining', 'Columbus', 'Large Metro', 'Midwest', 288000, 0.29, -5, 7, 11, 5, 5, 'AGR-2291', '2025-10-01', '2026-09-30'),
    op('OP-51348', 'Lakeshore Cantina', 'M', 'Casual Dining', 'Cleveland', 'Large Metro', 'Midwest', 331000, 0.55, 2, 14, 13, 4, 5, 'AGR-2291', '2026-02-01', '2027-01-31'),
    op('OP-51462', 'Brickyard Tavern', 'M', 'Casual Dining', 'Indianapolis', 'Large Metro', 'Midwest', 274000, 0.23, -4, 6, 10, 5, 5, 'AGR-2291', '2026-05-01', '2027-04-30'),
    op('OP-51579', 'Northside Supper Club', 'M', 'Casual Dining', 'Minneapolis', 'Large Metro', 'Midwest', 398000, 0.36, 0, 11, 12, 5, 5, 'AGR-2291', '2026-01-15', '2026-12-14'),

    // --- Large · Healthcare · Northeast · Large Metro -----------------------
    op('OP-20917', 'Pinecrest Senior Living', 'L', 'Healthcare', 'Boston', 'Large Metro', 'Northeast', 1260000, 0.89, 6, 31, 9, 3, 6, 'AGR-1107', '2026-01-01', '2026-12-31'),
    op('OP-52014', 'Mercy Harbor Hospital', 'L', 'Healthcare', 'New York', 'Large Metro', 'Northeast', 1890000, 0.34, -2, 7, 8, 6, 6, 'AGR-1107', '2026-04-01', '2027-03-31'),
    op('OP-52138', 'Fairmount Care Network', 'L', 'Healthcare', 'Philadelphia', 'Large Metro', 'Northeast', 1410000, 0.47, 1, 12, 9, 5, 6, 'AGR-1107', '2026-02-01', '2027-01-31'),
    op('OP-52245', 'Beacon Hill Rehab', 'L', 'Healthcare', 'Boston', 'Large Metro', 'Northeast', 1120000, 0.26, -3, 6, 10, 6, 6, 'AGR-1107', '2026-06-01', '2027-05-31'),
    op('OP-52367', 'Hudson Valley Elder Care', 'L', 'Healthcare', 'New York', 'Large Metro', 'Northeast', 1550000, 0.61, 4, 19, 9, 4, 6, 'AGR-1107', '2025-12-01', '2026-11-30'),
    op('OP-52481', 'Quincy General Hospital', 'L', 'Healthcare', 'Boston', 'Large Metro', 'Northeast', 1730000, 0.19, -6, 5, 8, 6, 6, 'AGR-1107', '2026-03-15', '2027-03-14'),

    // --- Large · Healthcare · Northeast · Small Metro -----------------------
    // Deliberately thin: St. Brigid has to widen its cohort to the whole region.
    op('OP-18840', 'St. Brigid Medical Center', 'L', 'Healthcare', 'Portland ME', 'Small Metro', 'Northeast', 1540000, 0.71, -3, 8, 6, 6, 6, 'AGR-1107', '2026-01-01', '2026-12-31'),
    op('OP-52596', 'Saranac Community Hospital', 'L', 'Healthcare', 'Saranac', 'Small Metro', 'Northeast', 980000, 0.31, -2, 7, 9, 6, 6, 'AGR-1107', '2026-07-01', '2027-06-30'),

    // --- Small · QSR · West · Large Metro -----------------------------------
    op('OP-31544', 'Blue Mesa Taqueria', 'S', 'QSR', 'Phoenix', 'Large Metro', 'West', 86000, 0.91, 14, 39, 12, 1, 4, 'AGR-3302', '2026-01-01', '2026-12-31'),
    op('OP-35061', 'Fresh Fork Kitchen', 'S', 'QSR', 'Denver', 'Large Metro', 'West', 64000, 0.77, 4, 15, 9, 2, 3, 'AGR-3302', '2026-01-01', '2026-12-31'),
    op('OP-13390', 'Golden Crust Pizzeria', 'S', 'QSR', 'Portland', 'Large Metro', 'West', 58000, 0.37, 1, 6, 7, 4, 4, 'AGR-3302', '2026-01-01', '2026-12-31'),
    op('OP-53102', 'Sunset Burrito Co', 'S', 'QSR', 'Los Angeles', 'Large Metro', 'West', 94000, 0.28, -3, 5, 8, 4, 4, 'AGR-3302', '2026-04-01', '2027-03-31'),
    op('OP-53247', 'Pacific Wok Express', 'S', 'QSR', 'Seattle', 'Large Metro', 'West', 71000, 0.52, 2, 11, 9, 3, 4, 'AGR-3302', '2026-02-15', '2027-02-14'),
    op('OP-53361', 'Mesa Grill House', 'S', 'QSR', 'Phoenix', 'Large Metro', 'West', 68000, 0.21, -4, 4, 7, 4, 4, 'AGR-3302', '2026-06-01', '2027-05-31'),
    op('OP-53488', 'Bayview Chicken Shack', 'S', 'QSR', 'San Diego', 'Large Metro', 'West', 82000, 0.45, 0, 8, 8, 4, 4, 'AGR-3302', '2025-11-01', '2026-10-31'),

    // --- Large · Education · South · Medium Metro ---------------------------
    op('OP-11820', 'Northfield School District', 'L', 'Education', 'Nashville', 'Medium Metro', 'South', 980000, 0.86, 3, 22, 7, 4, 6, 'AGR-0875', '2026-01-01', '2026-12-31'),
    op('OP-47102', 'Riverside University Dining', 'L', 'Education', 'Charleston', 'Medium Metro', 'South', 2110000, 0.42, -4, 4, 5, 6, 6, 'AGR-0875', '2026-01-01', '2026-12-31'),
    op('OP-54119', 'Magnolia County Schools', 'L', 'Education', 'Birmingham', 'Medium Metro', 'South', 1240000, 0.33, -2, 6, 6, 6, 6, 'AGR-0875', '2026-08-01', '2027-07-31'),
    op('OP-54236', 'Gulf Coast Community College', 'L', 'Education', 'Mobile', 'Medium Metro', 'South', 870000, 0.58, 3, 13, 7, 5, 6, 'AGR-0875', '2025-10-15', '2026-10-14'),
    op('OP-54347', 'Piedmont Academy Network', 'L', 'Education', 'Greenville', 'Medium Metro', 'South', 1060000, 0.24, -5, 5, 6, 6, 6, 'AGR-0875', '2026-05-01', '2027-04-30'),
    op('OP-54468', 'Live Oak ISD', 'L', 'Education', 'Baton Rouge', 'Medium Metro', 'South', 1330000, 0.49, 1, 9, 6, 5, 6, 'AGR-0875', '2026-03-01', '2027-02-28'),

    // --- Medium · Lodging · West · Medium Metro -----------------------------
    op('OP-22719', 'Lakeside Inn & Suites', 'M', 'Lodging', 'Boise', 'Medium Metro', 'West', 268000, 0.79, -2, 16, 11, 3, 4, 'AGR-4410', '2026-01-01', '2026-12-31'),
    op('OP-26655', 'Summit Ridge Resort', 'M', 'Lodging', 'Reno', 'Medium Metro', 'West', 390000, 0.18, -2, 5, 7, 5, 5, 'AGR-4410', '2026-01-01', '2026-12-31'),
    op('OP-55127', 'Canyon Lodge & Spa', 'M', 'Lodging', 'Flagstaff', 'Medium Metro', 'West', 342000, 0.38, 0, 8, 9, 4, 5, 'AGR-4410', '2026-04-15', '2027-04-14'),
    op('OP-55249', 'Harbor Point Hotel', 'M', 'Lodging', 'Eureka', 'Medium Metro', 'West', 289000, 0.62, 5, 17, 10, 3, 5, 'AGR-4410', '2025-12-15', '2026-12-14'),
    op('OP-55363', 'Juniper Creek Resort', 'M', 'Lodging', 'Bend', 'Medium Metro', 'West', 315000, 0.27, -3, 6, 8, 5, 5, 'AGR-4410', '2026-07-01', '2027-06-30'),
    op('OP-55478', 'Silver Sage Inn', 'M', 'Lodging', 'Santa Fe', 'Medium Metro', 'West', 254000, 0.51, 2, 12, 10, 4, 5, 'AGR-4410', '2026-02-01', '2027-01-31'),

    // --- Small · Casual Dining · South · Medium Metro -----------------------
    op('OP-29374', 'Tidewater Oyster Bar', 'S', 'Casual Dining', 'Charleston', 'Medium Metro', 'South', 72000, 0.64, -6, 9, 8, 3, 4, 'AGR-2291', '2026-01-01', '2026-12-31'),
    op('OP-56114', 'Bayou Smokehouse', 'S', 'Casual Dining', 'Baton Rouge', 'Medium Metro', 'South', 68000, 0.35, -2, 7, 9, 4, 4, 'AGR-2291', '2026-05-15', '2027-05-14'),
    op('OP-56238', 'Palmetto Fish Camp', 'S', 'Casual Dining', 'Savannah', 'Medium Metro', 'South', 81000, 0.48, 1, 10, 9, 3, 4, 'AGR-2291', '2026-03-01', '2027-02-28'),
    op('OP-56341', 'Azalea Street Cafe', 'S', 'Casual Dining', 'Mobile', 'Medium Metro', 'South', 59000, 0.22, -4, 5, 8, 4, 4, 'AGR-2291', '2026-06-15', '2027-06-14'),
    op('OP-56457', 'Delta Catfish House', 'S', 'Casual Dining', 'Jackson', 'Medium Metro', 'South', 74000, 0.57, 3, 13, 10, 3, 4, 'AGR-2291', '2025-11-15', '2026-11-14'),
    op('OP-56569', 'Spanish Moss Grill', 'S', 'Casual Dining', 'Tallahassee', 'Medium Metro', 'South', 66000, 0.31, -1, 6, 9, 4, 4, 'AGR-2291', '2026-04-01', '2027-03-31'),

    // --- Medium · Casual Dining · Northeast · Large Metro -------------------
    op('OP-57101', 'Brownstone Brasserie', 'M', 'Casual Dining', 'New York', 'Large Metro', 'Northeast', 445000, 0.67, 4, 20, 12, 3, 5, 'AGR-2291', '2026-02-01', '2027-01-31'),
    op('OP-57224', 'Commonwealth Kitchen', 'M', 'Casual Dining', 'Boston', 'Large Metro', 'Northeast', 378000, 0.30, -3, 8, 11, 5, 5, 'AGR-2291', '2026-05-01', '2027-04-30'),
    op('OP-57338', 'Liberty Row Tavern', 'M', 'Casual Dining', 'Philadelphia', 'Large Metro', 'Northeast', 402000, 0.53, 2, 15, 13, 4, 5, 'AGR-2291', '2025-12-01', '2026-11-30'),
    op('OP-57449', 'Rittenhouse Bistro', 'M', 'Casual Dining', 'Philadelphia', 'Large Metro', 'Northeast', 336000, 0.25, -5, 6, 11, 5, 5, 'AGR-2291', '2026-08-01', '2027-07-31'),

    // --- Small · Healthcare · Midwest · Medium Metro ------------------------
    op('OP-58102', 'Prairie View Clinic Group', 'S', 'Healthcare', 'Des Moines', 'Medium Metro', 'Midwest', 92000, 0.43, 0, 9, 10, 4, 5, 'AGR-1107', '2026-03-01', '2027-02-28'),
    op('OP-58217', 'Oakridge Nursing Home', 'S', 'Healthcare', 'Dayton', 'Medium Metro', 'Midwest', 78000, 0.59, 3, 14, 11, 3, 5, 'AGR-1107', '2026-01-15', '2026-12-14'),
    op('OP-58329', 'Cedar Falls Hospice', 'S', 'Healthcare', 'Cedar Rapids', 'Medium Metro', 'Midwest', 64000, 0.26, -3, 5, 9, 5, 5, 'AGR-1107', '2026-06-01', '2027-05-31'),
    op('OP-58431', 'Heartland Dialysis Centers', 'S', 'Healthcare', 'Peoria', 'Medium Metro', 'Midwest', 88000, 0.71, 6, 23, 10, 2, 4, 'AGR-1107', '2025-10-01', '2026-09-30'),

    // --- Large · Lodging · South · Large Metro ------------------------------
    op('OP-59103', 'Grand Bayou Hotel Group', 'L', 'Lodging', 'New Orleans', 'Large Metro', 'South', 1180000, 0.40, -1, 9, 8, 5, 6, 'AGR-4410', '2026-02-15', '2027-02-14'),
    op('OP-59228', 'Peachtree Suites', 'L', 'Lodging', 'Atlanta', 'Large Metro', 'South', 1420000, 0.22, -4, 5, 7, 6, 6, 'AGR-4410', '2026-05-01', '2027-04-30'),
    op('OP-59341', 'Gulfstream Resorts', 'L', 'Lodging', 'Tampa', 'Large Metro', 'South', 960000, 0.66, 5, 18, 9, 4, 6, 'AGR-4410', '2025-11-01', '2026-10-31'),
    op('OP-59457', 'Riverwalk Grand', 'L', 'Lodging', 'San Antonio', 'Large Metro', 'South', 1270000, 0.35, -2, 7, 8, 6, 6, 'AGR-4410', '2026-07-15', '2027-07-14'),

    // --- Medium · Education · Midwest · Medium Metro ------------------------
    op('OP-60114', 'Westbrook Charter Network', 'M', 'Education', 'Grand Rapids', 'Medium Metro', 'Midwest', 310000, 0.48, 1, 10, 8, 4, 5, 'AGR-0875', '2026-04-01', '2027-03-31'),
    op('OP-60236', 'Lakeland Technical College', 'M', 'Education', 'Madison', 'Medium Metro', 'Midwest', 275000, 0.20, -5, 4, 7, 5, 5, 'AGR-0875', '2026-06-15', '2027-06-14'),
    op('OP-60348', 'St. Aloysius Prep', 'M', 'Education', 'Fort Wayne', 'Medium Metro', 'Midwest', 248000, 0.56, 2, 12, 8, 4, 5, 'AGR-0875', '2025-12-15', '2026-12-14'),
    op('OP-60459', 'Great Lakes Academy', 'M', 'Education', 'Toledo', 'Medium Metro', 'Midwest', 292000, 0.33, -2, 6, 7, 5, 5, 'AGR-0875', '2026-03-15', '2027-03-14'),

    // --- Small · QSR · Midwest · Large Metro --------------------------------
    // Lapsed agreement still being bought against — rolled over, never renewed.
    op('OP-61102', 'Windy City Wings', 'S', 'QSR', 'Chicago', 'Large Metro', 'Midwest', 76000, 0.69, 5, 21, 10, 2, 4, 'AGR-3302', '2025-09-01', '2026-08-31'),
    op('OP-61214', 'Motor City Subs', 'S', 'QSR', 'Detroit', 'Large Metro', 'Midwest', 61000, 0.32, -2, 6, 8, 4, 4, 'AGR-3302', '2026-05-01', '2027-04-30'),
    op('OP-61327', 'Gateway Gyros', 'S', 'QSR', 'St. Louis', 'Large Metro', 'Midwest', 69000, 0.46, 1, 9, 9, 3, 4, 'AGR-3302', '2026-02-01', '2027-01-31'),
    op('OP-61438', 'Twin Cities Taco Stop', 'S', 'QSR', 'Minneapolis', 'Large Metro', 'Midwest', 84000, 0.24, -4, 5, 8, 4, 4, 'AGR-3302', '2026-07-01', '2027-06-30'),
  ];

  // Book-level aggregates for the Overview tab. The roster above is a sample;
  // these describe the whole 20K-operator base and are not derived from it.
  const INS = { high: { S: 800, M: 150, L: 50 }, medium: { S: 6000, M: 800, L: 200 }, low: { S: 9000, M: 2000, L: 1000 } };
  const MOVE = { high: { cur: 1000, last: 1100, same: 800, nw: 300 }, medium: { cur: 7000, last: 8000, same: 5000, nw: 3000 }, low: { cur: 12000, last: 16000, same: 10000, nw: 3000 } };
  const CARRY = { high: { S: 250, M: 45, L: 5, nw: 300 }, medium: { S: 2750, M: 200, L: 50, nw: 3000 }, low: { S: null, M: null, L: null, nw: 3000 } };
  const LOST = { S: 200, M: 40, L: 10 };
  const REV = { cur: [6, 19, 32], last: [5, 19.5, 30.8] };
  const SEG_REV = { S: 0.24, M: 0.33, L: 0.43 };

  return {
    SNAPSHOT_AS_OF, MONTHS, CATALOG, LINE_NAMES, LINE_C, TYPE_LINES,
    CUSTOMER_TYPES, REGIONS, METROS, ROSTER,
    INS, MOVE, CARRY, LOST, REV, SEG_REV,
  };
});
