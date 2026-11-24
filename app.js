"use strict";
/* Etsy Seller Profit & Fee Calculator — pure calculation + browser UI.
   No network calls. Safe to load in Node for tests (export guard at bottom). */

var FEE_DEFAULTS = {
  listingFee: 0.20,
  transactionRate: 0.065,      // 6.5%
  processingRate: 0.03,        // 3% (US preset)
  processingFlat: 0.25,        // $0.25 (US preset)
  regulatoryRate: 0            // 0% for US sellers (verified 2026-11-24, see README)
};

/* Seller-country fee presets. Payment processing is charged by Etsy Payments
   at the rate for the country of the seller's bank account.
   Fees verified as of 2026-11-24 (see README): most rates were corroborated by
   secondary sources citing Etsy's policy pages; the regulatory operating fee
   point — the list of countries it applies to, which includes neither the US
   nor Japan — was confirmed on Etsy's official Help Center.
   Both presets below have a 0% regulatory operating fee. */
var FEE_PRESETS = {
  US: { label: "United States", processingRate: 0.03, processingFlat: 0.25, regulatoryRate: 0 },
  JP: { label: "Japan", processingRate: 0.06, processingFlat: 0.30, regulatoryRate: 0 }
};

function feePreset(raw) {
  var key = raw && raw.preset ? String(raw.preset).toUpperCase() : "US";
  return FEE_PRESETS[key] || FEE_PRESETS.US;
}

function clampNonNegative(n) {
  var v = Number(n);
  if (!isFinite(v) || isNaN(v)) return 0;
  return v < 0 ? 0 : v;
}
function clampPercent(n) {
  var v = clampNonNegative(n);
  return v > 100 ? 100 : v;
}

/**
 * inputs: { price, shippingCharged, cogs, shippingCost, packaging,
 *           discountPercent, adsEnabled, adsPercent, regulatoryPercent }
 * All money in USD. Discount is a % off the item price only.
 * Revenue (total order amount) = price*(1-discount%) + shippingCharged.
 * Transaction / regulatory / processing / offsite-ads % fees are on revenue.
 */
function calculateProfit(raw) {
  raw = raw || {};
  var preset = feePreset(raw);
  var price = clampNonNegative(raw.price);
  var shippingCharged = clampNonNegative(raw.shippingCharged);
  var cogs = clampNonNegative(raw.cogs);
  var shippingCost = clampNonNegative(raw.shippingCost);
  var packaging = clampNonNegative(raw.packaging);
  var discountPercent = clampPercent(raw.discountPercent);
  var adsPercent = raw.adsEnabled ? clampPercent(raw.adsPercent == null ? 15 : raw.adsPercent) : 0;
  var regulatoryPercent = clampPercent(raw.regulatoryPercent);

  var discountAmount = price * discountPercent / 100;
  var discountedPrice = price - discountAmount;
  var totalRevenue = discountedPrice + shippingCharged;

  var listingFee = FEE_DEFAULTS.listingFee;
  var transactionFee = totalRevenue * FEE_DEFAULTS.transactionRate;
  var processingFee = totalRevenue * preset.processingRate + preset.processingFlat;
  var regulatoryFee = totalRevenue * regulatoryPercent / 100;
  var adsFee = totalRevenue * adsPercent / 100;

  var totalFees = listingFee + transactionFee + processingFee + regulatoryFee + adsFee;
  var sellerCosts = cogs + shippingCost + packaging;
  var totalCosts = totalFees + sellerCosts;
  var netProfit = totalRevenue - totalCosts;
  var profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    discountAmount: discountAmount,
    discountedPrice: discountedPrice,
    totalRevenue: totalRevenue,
    listingFee: listingFee,
    transactionFee: transactionFee,
    processingFee: processingFee,
    regulatoryFee: regulatoryFee,
    adsFee: adsFee,
    totalFees: totalFees,
    sellerCosts: sellerCosts,
    totalCosts: totalCosts,
    netProfit: netProfit,
    profitMargin: profitMargin
  };
}

/** Price at which net profit = 0, holding all other inputs fixed. Returns null if impossible. */
function breakEvenPrice(raw) {
  raw = raw || {};
  var preset = feePreset(raw);
  var shippingCharged = clampNonNegative(raw.shippingCharged);
  var sellerCosts = clampNonNegative(raw.cogs) + clampNonNegative(raw.shippingCost) + clampNonNegative(raw.packaging);
  var discountPercent = clampPercent(raw.discountPercent);
  var adsPercent = raw.adsEnabled ? clampPercent(raw.adsPercent == null ? 15 : raw.adsPercent) : 0;
  var regulatoryPercent = clampPercent(raw.regulatoryPercent);

  var variableRate = FEE_DEFAULTS.transactionRate + preset.processingRate
    + regulatoryPercent / 100 + adsPercent / 100;
  var keepRate = 1 - variableRate;
  if (keepRate <= 0) return null;
  var fixedFees = FEE_DEFAULTS.listingFee + preset.processingFlat;
  var revenueNeeded = (sellerCosts + fixedFees) / keepRate;
  var discountFactor = 1 - discountPercent / 100;
  if (discountFactor <= 0) return null;
  var price = (revenueNeeded - shippingCharged) / discountFactor;
  return price < 0 ? 0 : price;
}

/* ---------- Browser UI (skipped in Node) ---------- */
if (typeof document !== "undefined") {
  var fmt = function (n) { return "$" + Number(n || 0).toFixed(2); };
  var ids = ["price","shippingCharged","cogs","shippingCost","packaging","discountPercent","regulatoryPercent","adsPercent"];
  function readInputs() {
    var v = {};
    ids.forEach(function (id) { var el = document.getElementById(id); v[id] = el ? parseFloat(el.value) : 0; });
    var ads = document.getElementById("adsEnabled");
    var presetEl = document.getElementById("sellerCountry");
    return {
      price: v.price, shippingCharged: v.shippingCharged, cogs: v.cogs,
      shippingCost: v.shippingCost, packaging: v.packaging,
      discountPercent: v.discountPercent, regulatoryPercent: v.regulatoryPercent,
      adsEnabled: ads ? ads.checked : false, adsPercent: v.adsPercent,
      preset: presetEl ? presetEl.value : "US"
    };
  }
  function render() {
    var input = readInputs();
    var r = calculateProfit(input);
    var be = breakEvenPrice(input);
    var set = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
    set("outRevenue", fmt(r.totalRevenue));
    set("outDiscount", "-" + fmt(r.discountAmount));
    set("outListing", fmt(r.listingFee));
    set("outTransaction", fmt(r.transactionFee));
    set("outProcessing", fmt(r.processingFee));
    set("outRegulatory", fmt(r.regulatoryFee));
    set("outAds", fmt(r.adsFee));
    set("outTotalFees", fmt(r.totalFees));
    set("outSellerCosts", fmt(r.sellerCosts));
    set("outTotalCosts", fmt(r.totalCosts));
    set("outProfit", fmt(r.netProfit));
    set("outMargin", r.profitMargin.toFixed(2) + "%");
    set("outBreakEven", be === null ? "Not achievable at these fee rates" : fmt(be));
    var preset = FEE_PRESETS[input.preset] || FEE_PRESETS.US;
    set("processingNote", "— " + (preset.processingRate * 100).toFixed(0) + "% + $" + preset.processingFlat.toFixed(2) + " on the total order amount (" + preset.label + ")");
    var profitEl = document.getElementById("outProfit");
    if (profitEl) profitEl.style.color = r.netProfit < 0 ? "#b42318" : "#067647";
    var adsRow = document.getElementById("adsPercentRow");
    if (adsRow) adsRow.style.display = input.adsEnabled ? "" : "none";
  }
  document.addEventListener("DOMContentLoaded", function () {
    ids.concat(["adsEnabled", "sellerCountry"]).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener("input", render); el.addEventListener("change", render); }
    });
    var form = document.getElementById("waitlistForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var emailEl = document.getElementById("waitlistEmail");
        var msg = document.getElementById("waitlistMessage");
        var email = (emailEl.value || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          msg.textContent = "Please enter a valid email address.";
          msg.style.color = "#b42318";
          return;
        }
        // Real endpoint when configured (see waitlist-worker.js + its README):
        // window.WAITLIST_ENDPOINT = "https://<worker-subdomain>.workers.dev/waitlist"
        // When unset, falls back to the localStorage demo and says so honestly.
        var endpoint = (typeof window !== "undefined" && window.WAITLIST_ENDPOINT) || "";
        function saveLocally() {
          try {
            var list = JSON.parse(localStorage.getItem("etsyCalcWaitlist") || "[]");
            if (list.indexOf(email) === -1) list.push(email);
            localStorage.setItem("etsyCalcWaitlist", JSON.stringify(list));
          } catch (err) { /* localStorage unavailable */ }
        }
        function showSuccess(real) {
          msg.textContent = real
            ? "Thanks — you're on the waitlist!"
            : "Thanks — you're on the waitlist! (Demo: stored locally in this browser only — no real signup yet.)";
          msg.style.color = "#067647";
          emailEl.value = "";
        }
        if (endpoint) {
          fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, source: "etsy-profit-calculator", ts: new Date().toISOString() })
          }).then(function (res) {
            if (res.ok) { showSuccess(true); }
            else { saveLocally(); showSuccess(false); }
          }).catch(function () { saveLocally(); showSuccess(false); });
        } else {
          saveLocally();
          showSuccess(false);
        }
      });
    }
    render();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateProfit: calculateProfit, breakEvenPrice: breakEvenPrice, FEE_DEFAULTS: FEE_DEFAULTS, FEE_PRESETS: FEE_PRESETS };
}
