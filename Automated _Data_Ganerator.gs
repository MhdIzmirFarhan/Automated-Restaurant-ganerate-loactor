// // Google Apps Script to fetch restaurants/cafes in Bukit Jelutong
// // with all relevant fields and distance/time from Subang Jaya (One City)

function AutomatedDataEntry() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("x");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("x");
  } else {
    sheet.clear();
  }

  var apiKey = "AIzaSyDQ6hcdYdfklrBZQ-1E_Xd9wKdyx8eaRU4"; // Replace with your actual API key
  var businessTypes = ["restaurant, cafe"]; 
  var maxResults = 10;
  var collectedResults = 0;
  var location = "Puchong, Selangor, Malaysia";

  var franchiseKeywords = [
    // Fast food / Western
    "mcdonald", "kfc", "burger king", "pizza hut", "domino", "subway",
    "texas chicken", "a&w", "nando", "five guys", "wendy's", "hardee",
    "4 fingers", "nene chicken", "goobne", "bbq chicken",
  
    // Cafe / Drinks
    "starbucks", "zus coffee", "richiamo", "tealive", "chatime",
    "gong cha", "dunkin", "coffee bean", "cbtl",
    "gloria jean", "kenangan coffee", "hWC coffee",
  
    // Local Malaysian franchises
    "secret recipe", "kenny rogers", "marrybrown", "old town",
    "pappa rich", "oriental kopitiam", "madam kwan",
    "the chicken rice shop", "village park",
    "q bistro", "pelita", "kayra",
  
    // Japanese / Korean / Asian franchises
    "sushi king", "sushi zanmai", "sakae sushi", "ichiban boshi",
    "hanamaru", "gyu kaku", "ramen", "ippudo",
    "din tai fung", "paradise dynasty", "dragon-i",
  
    // Bakery / Dessert
    "breadtalk", "rt pastry", "lavender bakery",
    "baskin robbins", "llaollao", "inside scoop",
  
    // Pizza / General keywords
    "pizza", "cafe", "kopitiam", "western food"
  ];
  


  var existingEntries = new Set();
  var existingData = sheet.getDataRange().getValues();
  
  for (var i = 1; i < existingData.length; i++) {
    var entryKey = (existingData[i][1] + " | " + existingData[i][2]).toLowerCase(); // name + address
    existingEntries.add(entryKey);
  }

  sheet.appendRow([
    "No.", "Name", "Address", "Pos Code", "Phone", "Website", 
    "Distance (from One City)", "Time to Reach",
    "PIC", "PIC Contact", "Date Called", 
    "Appointment Scheduled", "Date", "Time","Remarks"
  ]);

  try {
    for (var typeIndex = 0; typeIndex < businessTypes.length; typeIndex++) {
      var businessType = businessTypes[typeIndex];
      var textSearchUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
                    encodeURIComponent("" + businessType + " in " + location) +
                    "&key=" + apiKey;

      var pageToken = "";

      do {
        var url = textSearchUrl;
        if (pageToken) url += "&pagetoken=" + pageToken;

        var response = UrlFetchApp.fetch(url);
        var json = JSON.parse(response.getContentText());

        if (json.results && json.results.length > 0) {
          for (var i = 0; i < json.results.length && collectedResults < maxResults; i++) {
            var place = json.results[i];

            // if (!place.name.toLowerCase().includes("indian")) continue;

            var isFranchise = franchiseKeywords.some(keyword =>
              place.name.toLowerCase().includes(keyword)
            );
            if (isFranchise) continue;

            var detailsUrl = "https://maps.googleapis.com/maps/api/place/details/json?" +
                             "place_id=" + place.place_id +
                             "&fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,price_level,types,business_status" +
                             "&key=" + apiKey;

            var detailsResponse = UrlFetchApp.fetch(detailsUrl);
            var detailsJson = JSON.parse(detailsResponse.getContentText());
            var details = detailsJson.result;
            
            if (!details || !details.business_status || details.business_status !== "OPERATIONAL") {
              continue;
            }

            var name = details.name || "N/A";
            var address = details.formatted_address || place.formatted_address || "N/A";
            var postcode = 'N/A';
            var postcodeMatch = address.match(/\b\d{5}\b/);

            if (postcodeMatch) {
              postcode = parseInt(postcodeMatch[0]);
            }else{
              postcode = 0;
            }
            var phone = details.formatted_phone_number || "N/A";
            var website = details.website || "N/A";
            // var openingHours = details.opening_hours ? details.opening_hours.weekday_text.join("\n") : "N/A";
            // var rating = details.rating || "N/A";
            // var priceLevel = details.price_level ? "$".repeat(details.price_level) : "N/A";
            // var types = details.types ? details.types.filter(t => t !== "point_of_interest" && t !== "establishment").join(", ") : "N/A";

            var distance = "N/A";
            var duration = "N/A";

            try {
              var distanceUrl = "https://maps.googleapis.com/maps/api/distancematrix/json?origins=" +
                                encodeURIComponent("One City, Subang Jaya, Malaysia") +
                                "&destinations=" + encodeURIComponent(address) +
                                "&key=" + apiKey;

              var distanceResponse = UrlFetchApp.fetch(distanceUrl);
              var distanceData = JSON.parse(distanceResponse.getContentText());

              if (
                distanceData.rows &&
                distanceData.rows[0] &&
                distanceData.rows[0].elements &&
                distanceData.rows[0].elements[0].status === "OK"
              ) {
                distance = distanceData.rows[0].elements[0].distance.text || "N/A";
                duration = distanceData.rows[0].elements[0].duration.text || "N/A";
              }
            } catch (e) {
              Logger.log("Distance error: " + e.toString());
            }

            var entryKey = (name + " | " + address).toLowerCase();
            if (existingEntries.has(entryKey)) {
              Logger.log("🔁 Skipping duplicate: " + name);
              continue; // skip this place
            }
            existingEntries.add(entryKey); // mark this one as added
            

            sheet.appendRow([
              collectedResults + 1,
              name,
              address,
              postcode,
              phone,
              website,
              // openingHours,
              // rating,
              // priceLevel,
              // types,
              distance,
              duration,
              "", // PIC
              "", // PIC Contact
              "", // Date Called
              "", // Appointment Scheduled
              "", // Date
              "",  // Time
              "Uncontacted" // Remarks
            ]);

            collectedResults++;
            Utilities.sleep(1000);
          }
        }

        pageToken = json.next_page_token || "";
        if (pageToken && collectedResults < maxResults) {
          Utilities.sleep(2000);
        }

      } while (pageToken && collectedResults < maxResults);
    }

    if (sheet.getLastRow() > 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).sort({ column: 4, ascending: false });
    }

    Logger.log("Collected " + collectedResults + " restaurants/cafes.");

  } catch (e) {
    Logger.log("Error: " + e.toString());
    sheet.getRange(2, 1).setValue("Error occurred: " + e.message);
  }
}

// Google Apps Script replacement using OpenStreetMap Overpass API
// No API key needed. Filters for Indian restaurants only.

// function fetchAllRestaurantsOSM() {
//   const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//   sheet.clear(); // Clear old data

//   // ✅ Only show what you want
//   sheet.appendRow(["Name", "Address", "Postcode", "Phone", "Website"]);

//   const location = "Negeri Sembilan"; // Change this to other states like "Negeri Sembilan", "Selangor", etc.
//   const query = `
//     [out:json][timeout:25];
//     area["name"="${location}"]->.searchArea;
//     (
//       node["amenity"="restaurant"](area.searchArea);
//       way["amenity"="restaurant"](area.searchArea);
//       relation["amenity"="restaurant"](area.searchArea);
//     );
//     out center tags;
//   `;

//   const url = "https://overpass-api.de/api/interpreter";

//   const response = UrlFetchApp.fetch(url, {
//     method: "post",
//     payload: { data: query },
//     muteHttpExceptions: true,
//   });

//   const json = JSON.parse(response.getContentText());

//   if (!json.elements || json.elements.length === 0) {
//     Logger.log("No data found");
//     return;
//   }

//   json.elements.forEach(el => {
//     const tags = el.tags || {};
//     const name = tags.name || "Indian";
    
//     const address = [
//       tags["addr:street"] || "",
//       tags["addr:housenumber"] || "",
//       tags["addr:city"] || "",
//       tags["addr:state"] || ""
//     ].filter(Boolean).join(", ");
    
//     const postcode = tags["addr:postcode"] || "";
//     const phone = tags.phone || tags["contact:phone"] || "";
//     const website = tags.website || tags["contact:website"] || "";

//     // ✅ Only insert what you want
//     sheet.appendRow([name, address, postcode, phone, website]);
//   });

//   Logger.log("Done fetching restaurants in " + location);
// }


// function fetchIndianRestaurantsOSM() {
//   const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//   sheet.clear(); // Clear old data

//   // ✅ Set header
//   sheet.appendRow(["Name", "Address", "Postcode", "Phone", "Website"]);

//   const location = "Negeri Sembilan"; // You can change this
//   const query = `
//     [out:json][timeout:25];
//     area["name"="${location}"]->.searchArea;
//     (
//       node["amenity"="restaurant"]["cuisine"~"indian",i](area.searchArea);
//       way["amenity"="restaurant"]["cuisine"~"indian",i](area.searchArea);
//       relation["amenity"="restaurant"]["cuisine"~"indian",i](area.searchArea);
//     );
//     out center tags;
//   `;

//   const url = "https://overpass-api.de/api/interpreter";

//   const response = UrlFetchApp.fetch(url, {
//     method: "post",
//     payload: { data: query },
//     muteHttpExceptions: true,
//   });

//   const json = JSON.parse(response.getContentText());

//   if (!json.elements || json.elements.length === 0) {
//     Logger.log("No Indian restaurants found.");
//     return;
//   }

//   json.elements.forEach(el => {
//     const tags = el.tags || {};
//     const name = tags.name || "Unnamed Indian Restaurant";

//     const address = [
//       tags["addr:street"] || "",
//       tags["addr:housenumber"] || "",
//       tags["addr:city"] || "",
//       tags["addr:state"] || ""
//     ].filter(Boolean).join(", ");

//     const postcode = tags["addr:postcode"] || "";
//     const phone = tags.phone || tags["contact:phone"] || "";
//     const website = tags.website || tags["contact:website"] || "";

//     // ✅ Append only Indian restaurants
//     sheet.appendRow([name, address, postcode, phone, website]);
//   });

//   Logger.log("Done fetching Indian restaurants in " + location);
// }

