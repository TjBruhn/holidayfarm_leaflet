// javascript by Trever J. Bruhn 2022
console.log("Branch: add search");
//function to instantiate leaflet map
function createMap() {
  //==== define basemaps to be used in the map ====
  //add OSM base tile layer
  var osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  });

  var Stadia_AlidadeSmooth = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
    }
  );
  // var mbAttr =
  //   'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>';
  // copied url from tutorial probably don't use
  // var mbUrl =
  //   "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

  // var streets = L.tileLayer(mbUrl, {
  //   id: "mapbox/streets-v11",
  //   tileSize: 512,
  //   zoomOffset: -1,
  //   attribution: mbAttr,
  // });
  // var satellite = L.tileLayer(mbUrl, {
  //   id: "mapbox/satellite-v9",
  //   tileSize: 512,
  //   zoomOffset: -1,
  //   attribution: mbAttr,
  // });

  //add the layers
  var parcels = addParcelLayer();
  var sales = addSalesLayer();
  var rebuild = addRebuildLayer();
  var damage = addAssessDamageLayer();
  var address = addAddressLayer();

  //variables needed for goToFeature
  var identifiedFeature;
  const tableElems = [
    "#maplot",
    "#address",
    "#rebuild",
    "#tempHousing",
    "#sales",
    "#damage",
  ];

  //create the map
  var map = L.map("map", {
    center: [44.15, -122.45],
    zoomControl: false,
    zoom: 12,
    minZoom: 11,
    layers: [osm, parcels, rebuild, sales, address], //these will be loaded with the map
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
      return (
        feature.properties["House Number"] +
        " - " +
        feature.properties["Concatenated Full Address"]
      ); // format suggestions like this.
    },
    bufferRadius: 100,
  });

  var taxlotSearch = L.esri.Geocoding.mapServiceProvider({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/Parcels/MapServer",
    layers: [0],
    searchFields: ["maptaxlot", "maptaxlot_hyphen"], // Search these fields for text matches
    label: "Maptaxlot", // Group suggestions under this header
    formatSuggestion: function (feature) {
      return (
        feature.properties["maptaxlot"] +
        " - " +
        feature.properties["maptaxlot_hyphen"]
      ); // format suggestions like this.
    },
    bufferRadius: 1,
  });

  var searchControl = L.esri.Geocoding.geosearch({
    providers: [addrSearch, taxlotSearch], // will geocode via addressParcel Mapserver.
    placeholder: "house number, address, or maptaxlot",
  }).addTo(map);

  searchControl.on("results", function (e) {
    console.log("results", e.results);
    goToFeature(
      e,
      identifiedFeature,
      tableElems,
      map,
      parcels,
      address,
      rebuild,
      sales,
      damage
    );
  });

  //add address labels
  addAddrLabels(map);

  //==== add in layer controls ====
  //create basemaps object to be passed to layercontrol
  var baseMaps = {
    OpenStreetMap: osm,
    "Light Grey": Stadia_AlidadeSmooth,
  };

  //create overlayers object to be passed to layercontrol
  var overlayers = {
    Parcels: parcels,
    Sales: sales,
    "Rebuild Status": rebuild,
    "Structure Damage": damage,
    Address: address,
  };

  //create layer control
  var layerControl = L.control
    .layers(baseMaps, overlayers, { autoZIndex: "false" })
    .addTo(map);

  //==== create event listener to send data to panel on click ====
  map.on("click", function (e) {
    return (identifiedFeature = goToFeature(
      e,
      identifiedFeature,
      tableElems,
      map,
      parcels,
      address,
      rebuild,
      sales,
      damage
    ));
  }); //XXX END map.on

  //add event listener to clear button to close pane
  $("#clearButton").on("click", function (e) {
    //pane.html("Loading");
    $(".leaflet-interactive").remove();
    tableElems.forEach(function (element) {
      $(element).html("No Data");
    });
    $("#map").css({ width: "100%", "border-radius": "0 0 1em 1em" });
    $("#selectedFeatures").css("display", "none");
    map.invalidateSize();
  });

  //===== event listeners to produce counts =====
  countFeatures(map, rebuild, sales);

  //add filter filtered is used to determine whether to filter or restore the map
  var filtered = false;
  filter(map, rebuild, sales, filtered);
} //XXX END createMap

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
    layers: [3],
    opacity: 1,
  });
}

// add address point layer
function addAddressLayer() {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/LaneCountyMaps/AddressParcel/MapServer",
    layers: [0, 3], //0=address points 3=building footprint
  });
}

//add address labels to the map
function addAddrLabels(map) {
  var addrLayer = L.esri
    .featureLayer({
      url: "https://lcmaps.lanecounty.org/arcgis/rest/services/LaneCountyMaps/AddressParcel/MapServer/0",
      where:
        "five_digit_zip_code='97488' OR five_digit_zip_code='97478'OR five_digit_zip_code='97413'",
      minZoom: 16,
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

//==== other functions ====
//make map and pane dynamic used in map.on-click
function activatePane(map, identifiedFeature) {
  $("#map").css({ width: "65%", "border-radius": "0 0 0 1em" });
  map.invalidateSize();
  $("#selectedFeatures").css("display", "flex");

  //center of selected feature
  map.flyToBounds(identifiedFeature.getBounds());
}

function goToFeature(
  e,
  identifiedFeature,
  tableElems,
  map,
  parcels,
  address,
  rebuild,
  sales,
  damage
) {
  //e=event
  //clear the selected feature on the map and reset the selected features pane
  console.log("latlng", e.latlng);
  console.log("identified feature", identifiedFeature);
  $(".leaflet-interactive").remove();

  tableElems.forEach(function (element) {
    $(element).html("No Data");
  });

  //identify the feature clicked in parcels
  parcels
    .identify()
    .layers("all:0") // just the counties sublayer
    .on(map)
    .at(e.latlng)
    .run(function (error, featureCollection) {
      if (error) {
        return;
      }

      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        identifiedFeature = L.geoJSON(featureCollection.features[0]).addTo(map);
        //open pane zoom to feature
        activatePane(map, identifiedFeature);

        //write all intersecting maplot #s to pane
        var maplot = featureCollection.features[0].properties.maptaxlot;
        $("#maplot").html(maplot);
        //get geometry to search intersecting address points
        var maplotBounds = featureCollection.features[0].geometry;

        //pull address if one or more is within this feature
        address
          .identify()
          .layers("all:0")
          .on(map)
          .at(maplotBounds)
          .run(function (error, featureCollection) {
            if (error) {
              return;
            }
            // make sure at least one feature was identified.
            if (featureCollection.features.length > 0) {
              //write all intersecting addresses to pane
              multiAddr(featureCollection);
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
        return;
      }
      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        //write all intersected sales dates to pane
        var sales = featureCollection.features[0].properties.deed_transfer_date;
        $("#sales").html(sales);
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
        return;
      }
      // make sure at least one feature was identified.
      if (featureCollection.features.length > 0) {
        //write all intersected damage status to pane
        $("#damage").html("Yes");
      }
    });
  return identifiedFeature;
} //XXX END goToFeature

//deal with multiple addresses on one parcel used in map.on-click
function multiAddr(featureCollection) {
  //if multiple addresses are selected add unique addresses
  //clear address field
  $("#address").html("");

  //set array for determining unique
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
            console.log(error);
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
          console.log(error);
        } else {
          $("#sold").html(count);
        }
      });

    rebuild
      .query()
      .layer(0)
      .where("TempHousing='Yes'")
      .intersects(map.getBounds())
      .count(function (error, count) {
        if (error) {
          console.log(error);
        } else {
          $("#tempHouse").html(count);
        }
      });
  });
}

//applyfilters when counter box is clicked
function filter(map, rebuild, sales, filtered) {
  $(".countBox.count").on("click ", function (event) {
    //hide everything but this also dispalys everything on second click
    var allElse = ".countBox:not(." + this.classList[2] + ")";
    $(allElse).toggle();

    //array for determining if this is a rebuild status
    var status = [
      "NotStarted",
      "InProgress",
      "SomePermCompleteSomeNot",
      "PermComplete",
    ];
    if (filtered) {
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
      //if not currently filtered change filtered and filter layers
      filtered = true;
      //apply filters
      if (status.includes(this.id)) {
        //make sure layer is added to map
        map.addLayer(rebuild);
        //filter rebuild status layer (1) by status and filter temp housing (0) to hide it
        rebuild.setLayerDefs({
          1: "RebuildStatus='" + this.id + "'",
          0: "TempHousing='No'",
        });
        //turn off sales
        map.removeLayer(sales);
      } else if (this.id === "sold") {
        //make sure layer is added to map
        map.addLayer(sales);
        //turn off sales
        map.removeLayer(rebuild);
      } else if (this.id === "tempHouse") {
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
