// javascript by Trever J. Bruhn 2022
console.log("branch add search");
//function to instantiate leaflet map
function createMap() {
  //==== define basemaps to be used in the map ====
  //add OSM base tile layer
  var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  });
  //add a grey base tile layer
  var CartoDB_Positron = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  //add the layers
  var parcels = addParcelLayer();
  var sales = addSalesLayer();
  var rebuild = addRebuildLayer();
  var damage = addAssessDamageLayer();
  var address = addAddressLayer();
  var burnBoundary = addBurnBoundary();

  //variables needed for goToFeature function
  const tableElems = [
    "#maplot",
    "#address",
    "#rebuild",
    "#tempHousing",
    "#sales",
    "#damage",
    "#rlid_link a",
  ];

  //set an extent within which to constrain searches this is the original extent of the map frame at load
  const northEast = L.latLng(44.222813960308336, -122.1889114379883);
  const southWest = L.latLng(44.07722688523791, -122.7107620239258);
  const searchBounds = L.latLngBounds(northEast, southWest);

  //create the map
  var map = L.map("map", {
    center: [44.15, -122.45],
    zoomControl: false,
    zoom: 11,
    minZoom: 11,
    layers: [osm, parcels, rebuild, sales, address, burnBoundary], //these will be loaded with the map
  });

  //addZoomhome
  var zoomHome = L.Control.zoomHome();
  zoomHome.addTo(map);

  //add search control
  var addrSearch = L.esri.Geocoding.mapServiceProvider({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/LaneCountyMaps/AddressParcel/MapServer",
    layers: [0],
    searchFields: ["House Number", "Concatenated Full Address"], // Search these fields for text matches
    label: "House number or address", // Group suggestions under this header
    formatSuggestion: function (feature) {
      // format suggestions like this.
      return (
        feature.properties["House Number"] +
        " - " +
        feature.properties["Concatenated Full Address"]
      );
    },
    bufferRadius: 1,
  });

  var taxlotSearch = L.esri.Geocoding.mapServiceProvider({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/Parcels/MapServer",
    layers: [0],
    searchFields: ["maptaxlot", "maptaxlot_hyphen"], // Search these fields for text matches
    label: "Maptaxlot", // Group suggestions under this header
    formatSuggestion: function (feature) {
      // format suggestions like this.
      return (
        feature.properties["maptaxlot"] +
        " - " +
        feature.properties["maptaxlot_hyphen"]
      );
    },
  });

  var searchControl = L.esri.Geocoding.geosearch({
    providers: [addrSearch, taxlotSearch], // will geocode via addressParcel Mapserver.
    placeholder: "house number, address, or maptaxlot",
    zoomToResult: false,
    searchBounds: searchBounds,
  }).addTo(map);

  //use search results to goToFeature zooming to feature and activating panel
  searchControl.on("results", function (e) {
    // and reset the selected features pane
    tableElems.forEach(function (element) {
      $(element).html("Loading Data");
    });
    //move the map view to the searched feature
    map.flyTo(e.latlng, 16);
    //after the map view is over the feature zoom to and activate panel
    map.once("moveend zoomend", function () {
      goToFeature(e, tableElems, map, parcels, address, rebuild, sales, damage);
    });
  });

  //add address labels
  addAddrLabels(map);

  //add label to burn boundary
  L.marker([44.21564108484721, -122.5627899169922], {
    keyboard: false, //prevent keyboard tab to
    icon: L.divIcon({
      iconSize: null,
      className: "burnBound",
      html: "Holiday Farm Fire Burn Boundary",
    }),
  }).addTo(map);

  //==== add in layer controls ====
  //create basemaps object to be passed to layercontrol
  var baseMaps = {
    OpenStreetMap: osm,
    Grey: CartoDB_Positron,
  };

  //create overlayers object to be passed to layercontrol
  var overlayers = {
    Parcels: parcels,
    Sales: sales,
    "Rebuild Status": rebuild,
    Address: address,
    "Burn Boundary": burnBoundary,
    "Structure Damage": damage,
  };

  //create layer control
  var layerControl = L.control
    .layers(baseMaps, overlayers, { autoZIndex: "false" })
    .addTo(map);

  //===== create event listeners  =====

  //create event listener to send data to panel on click
  map.on("click", function (e) {
    goToFeature(e, tableElems, map, parcels, address, rebuild, sales, damage);
  });

  //add event listener to clear button to close pane
  $("#clearButton").on("click", function (e) {
    //remove the selection polygon
    $(".identifiedFeature").remove();
    //clear the panel
    tableElems.forEach(function (element) {
      $(element).html("No Data");
    });
    //return map to full width
    $("#map").css({ width: "100%", "border-radius": "0 0 1em 1em" });
    //hide display
    $("#selectedFeatures").css("display", "none");
    //reset map size to allow for new center
    map.invalidateSize();
  });

  //add event listener to produce counts
  countFeatures(map, rebuild, sales);

  //add filter filtered is used to determine whether to filter or restore the map
  var filtered = false;
  //filter map if one of the count bozes is clicked
  filter(map, rebuild, sales, filtered);
}
//XXX
// ===========END createMap ===========
//XXX

//==== create dynamic map layers ====

// add Parcel layer
function addParcelLayer() {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/Parcels/MapServer",
  });
}

// add sales layer
function addSalesLayer() {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/HFFAreaSales/MapServer",
  });
}

// add rebuild status layer
function addRebuildLayer() {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/ParcelsRebuildStatus/MapServer",
    opacity: 0.5,
  });
}

// add assessed damaged layer
function addAssessDamageLayer() {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/RightOfEntry/MapServer",
    layers: [3], //only the parcels with damage layer
    opacity: 1,
  });
}

// add address point layer
function addAddressLayer() {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/LaneCountyMaps/AddressParcel/MapServer",
    layers: [0, 3], //0=address points 3=building footprints
  });
}

//add address labels to the map
function addAddrLabels(map) {
  var addrLayer = L.esri
    .featureLayer({
      url: "https://lcmaps.lanecounty.org/arcgis/rest/services/LaneCountyMaps/AddressParcel/MapServer/0",
      where:
        "five_digit_zip_code='97489' OR five_digit_zip_code='97488' OR five_digit_zip_code='97478'OR five_digit_zip_code='97413'",
      minZoom: 17,
      pointToLayer: function (geojson, latlng) {
        return L.marker(latlng, {
          icon: L.divIcon({
            iconSize: null,
            className: "label",
            html: "<div>" + geojson.properties.house_nbr + "</div>",
          }),
        });
      },
    })
    .addTo(map);
}

function addBurnBoundary() {
  return L.esri.featureLayer({
    url: "https://services5.arcgis.com/9s1YtFmLS0YTl10F/arcgis/rest/services/Holiday_Farm_Fire_Boundary/FeatureServer/0",
    style: {
      color: "#f55a42",
      fill: false,
    },
  });
}

//==== other functions ====
//make map and pane dynamic used in map.on-click
function activatePane(map, identifiedFeature) {
  //shrink map to allow panel to fit
  $("#map").css({ width: "66.666%", "border-radius": "0 0 0 1em" });
  //allow for map center to be based on new map frame
  map.invalidateSize();
  //display the panel
  $("#selectedFeatures").css("display", "flex");
  //center map on selected feature
  map.flyToBounds(identifiedFeature.getBounds());
}

function goToFeature( //e=event
  e,
  tableElems,
  map,
  parcels,
  address,
  rebuild,
  sales,
  damage
) {
  //clear the selected feature on the map
  $(".identifiedFeature").remove();

  // and reset the selected features pane
  tableElems.forEach(function (element) {
    $(element).html("Loading Data");
  });

  //identify the feature clicked/searched in parcels
  parcels
    .identify()
    .layers("all:0") // just the counties sublayer
    .on(map)
    .at(e.latlng)
    .run(function (error, featureCollection) {
      if (error) {
        console.log("error", error);
        return;
      }

      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        //add a feature to highlight the selected feature
        let identifiedFeature = L.geoJSON(featureCollection.features[0], {
          style: {
            color: "#f5f242",
            fill: false,
          },
          className: "identifiedFeature",
        }).addTo(map);
        //open pane and zoom to feature
        activatePane(map, identifiedFeature);

        //write all intersecting maplot #s to pane
        var maplot = featureCollection.features[0].properties.maptaxlot;
        $("#maplot").html(maplot);

        var rlid_link = featureCollection.features[0].properties.rlid_link;
        $("#rlid_link a").attr("href", rlid_link);
        $("#rlid_link a").html("View on RLID");

        //get geometry to search intersecting address points
        var maplotBounds = featureCollection.features[0].geometry;

        //pull address if one or more is within this feature
        address
          .identify()
          .layers("all:0")
          .on(map)
          .at(maplotBounds)
          .layerDef(0, "maptaxlot='" + maplot + "'")
          .run(function (error, featureCollection) {
            if (error) {
              console.log("error", error);
              return;
            }
            // make sure at least one feature was identified.
            if (featureCollection.features.length > 0) {
              //write all intersecting addresses to pane
              multiAddr(featureCollection);
            } else {
              $("#address").html("No Data");
            }
          });
      }
    });
  //identify the feature clicked in rebuild
  rebuild
    .identify()
    .layers(1) // just the parcels sublayer
    .on(map)
    .at(e.latlng)
    .run(function (error, featureCollection) {
      if (error) {
        console.log("error", error);
        return;
      }
      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        //write all intersected rebuild status to pane
        var rebuildStatus =
          featureCollection.features[0].properties.RebuildStatus;
        $("#rebuild").html(rebuildStatus);
        //write all intersected temp housing status to pane
        var tempHousing = featureCollection.features[0].properties.TempHousing;
        $("#tempHousing").html(tempHousing);
      } else {
        $("#rebuild").html("No Data");
        $("#tempHousing").html("No Data");
      }
    });

  //identify the feature clicked in sales
  sales
    .identify()
    .layers(0)
    .on(map)
    .at(e.latlng)
    .run(function (error, featureCollection) {
      if (error) {
        console.log("error", error);
        return;
      }
      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        //write all intersected sales dates to pane
        var sales = featureCollection.features[0].properties.deed_transfer_date;
        $("#sales").html(sales);
      } else {
        $("#sales").html("No Data");
      }
    });

  //identify the feature clicked in damage
  damage
    .identify()
    .layers("3") //only the structure damage layer
    .on(map)
    .at(e.latlng)
    .run(function (error, featureCollection) {
      if (error) {
        console.log("error", error);
        return;
      }
      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        //write all intersected damage status to pane
        $("#damage").html("Yes");
      } else {
        $("#damage").html("No Data");
      }
    });
} //XXX END goToFeature

//deal with multiple addresses on one parcel used in map.on-click
function multiAddr(featureCollection) {
  //if multiple addresses are selected add unique addresses
  //clear address field
  $("#address").html("");

  //set array for determining unique addresses
  var houseNmbr = [];
  //iterate through all available addresses
  for (let i = 0; i < featureCollection.features.length; i++) {
    //set address value to be written
    var address =
      featureCollection.features[i].properties["House Number"] +
      " " +
      featureCollection.features[i].properties["Street Name"] +
      " " +
      featureCollection.features[i].properties["Street Type Code"];

    //pass unique addresses on
    if (i + 1 === featureCollection.features.length) {
      //the last or only address append the address
      $("#address").append(address);
    } else {
      //test that it is a different address !!! uses NOT operator
      if (!houseNmbr.includes(address)) {
        //push unique addresses to array
        houseNmbr.push(address);
        //append the address with a break
        $("#address").append(address + " <br> ");
      }
    }
  }
}

//Dynamically populate the count bar with counts of feature in visable in the view
function countFeatures(map, rebuild, sales) {
  map.on("layeradd  moveend", function (event) {
    //count rebuild status in view
    //set array to loop through possible statuses
    var status = [
      "NotStarted",
      "InProgress",
      "SomePermCompleteSomeNot",
      "PermComplete",
    ];
    //function to count all features using status Item as where clause
    function countRebuild(statusItem) {
      rebuild
        .query()
        .layer(1)
        .where("RebuildStatus='" + statusItem + "'")
        .intersects(map.getBounds())
        .count(function (error, count) {
          if (error) {
            console.log("error", error);
          } else {
            $("#" + statusItem).html(count);
          }
        });
    }
    //loop through each status and call count function
    status.forEach(countRebuild);

    //count sales in view
    sales
      .query()
      .layer(0)
      .intersects(map.getBounds())
      .count(function (error, count) {
        if (error) {
          console.log("error", error);
        } else {
          $("#sold").html(count);
        }
      });

    //count temporary housing in view
    rebuild
      .query()
      .layer(0)
      .where("TempHousing='Yes'")
      .intersects(map.getBounds())
      .count(function (error, count) {
        if (error) {
          console.log("error", error);
        } else {
          $("#tempHouse").html(count);
        }
      });
  });
}

//applyfilters when counter box is clicked
function filter(map, rebuild, sales, filtered) {
  //add tool tip to help inform that these are filter buttons and switch filterIcon transparency
  $(".countBox.count")
    .on("mouseenter", function () {
      if (filtered) {
        $(this).css("cursor", "pointer").attr("title", "remove filter");
      } else {
        $(this).css("cursor", "pointer").attr("title", "click to filter");
      }
      //make icon filter not transparent
      $("." + this.classList[2] + " .filterIcon").css("opacity", "1");
    })
    .on("mouseleave", function () {
      $(this).css("cursor", "auto");
      //make icon filter transparent again
      $("." + this.classList[2] + " .filterIcon").css("opacity", ".3");
    });

  $(".countBox.count").on("click", function (event) {
    //hide everything on first click also displays everything on second click
    var allElse = ".countBox:not(." + this.classList[2] + ")";
    $(allElse).toggle();

    let filterId = this.lastElementChild.id;

    //array for determining if this is a rebuild status
    var status = [
      "NotStarted",
      "InProgress",
      "SomePermCompleteSomeNot",
      "PermComplete",
    ];
    if (filtered) {
      //return this to one column wide
      $("." + this.classList[2]).css("grid-column", "span 1");
      //if currently filtered change filtered and restore all layers
      filtered = false;
      map.addLayer(sales);
      map.addLayer(rebuild);
      //reset layer defs to include all original features
      rebuild.setLayerDefs({
        0: "TempHousing='Yes'",
        1: "OBJECTID>0",
      });
    } else {
      //expand this across all columns
      $("." + this.classList[2]).css("grid-column", "span 6");
      //if not currently filtered change filtered and filter layers
      filtered = true;
      //apply filters
      if (status.includes(filterId)) {
        //make sure layer is added to map
        map.addLayer(rebuild);
        //filter rebuild status layer (1) by status and filter temp housing (0) to hide it
        rebuild.setLayerDefs({
          1: "RebuildStatus='" + filterId + "'",
          0: "TempHousing='No'",
        });
        //turn off sales
        map.removeLayer(sales);
      } else if (filterId === "sold") {
        //make sure layer is added to map
        map.addLayer(sales);
        //turn off sales
        map.removeLayer(rebuild);
      } else if (filterId === "tempHouse") {
        //make sure layer is added to map
        map.addLayer(rebuild);
        //set temp housing (0) to yes to show and filter rebuild status layer (1) bu null to hide it
        rebuild.setLayerDefs({
          0: "TempHousing='Yes'",
          1: "RebuildStatus='null'",
        });
        //turn off sales
        map.removeLayer(sales);
      }
    }
  });
}

$(createMap);
