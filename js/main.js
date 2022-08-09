// javascript by Trever J. Bruhn 2022
console.log("branch: add filters");
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
  var parcels = addParcelLayer(map);
  var sales = addSalesLayer(map);
  var rebuild = addRebuildLayer(map);
  var damage = addAssessDamageLayer(map);
  var address = addAddressLayer(map);

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
  let identifiedFeature;

  let tableElems = [
    "#maplot",
    "#address",
    "#rebuild",
    "#tempHousing",
    "#sales",
    "#damage",
  ];

  map.on("click", function (e) {
    //clear the selected feature on the map and reset the selected features pane
    if (identifiedFeature) {
      map.removeLayer(identifiedFeature);
      tableElems.forEach(function (element) {
        $(element).html("No Data");
      });
    }

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
          identifiedFeature = L.geoJSON(featureCollection.features[0]).addTo(
            map
          );
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
          var tempHousing =
            featureCollection.features[0].properties.TempHousing;
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
          var sales =
            featureCollection.features[0].properties.deed_transfer_date;
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
  }); //XXX END map.on

  //add event listener to clear button to close pane
  $("#clearButton").on("click", function (e) {
    //pane.html("Loading");
    if (identifiedFeature) {
      map.removeLayer(identifiedFeature);
      tableElems.forEach(function (element) {
        $(element).html("No Data");
      });
    }
    $("#map").css({ width: "100%", "border-radius": "0 0 1em 1em" });
    $("#selectedFeatures").css("display", "none");
    map.invalidateSize();
  });

  //===== event listeners to produce counts =====
  countFeatures(map, rebuild, sales);
} //XXX END createMap

//==== create dynamic map layers ====

// add Parcel layer
function addParcelLayer(map) {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/Parcels/MapServer",
  });
}

// add sales layer
function addSalesLayer(map) {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/HFFAreaSales/MapServer",
  });
}

// add rebuild status layer
function addRebuildLayer(map) {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/ParcelsRebuildStatus/MapServer",
    opacity: 0.5,
  });
}

// add assessed damaged layer
function addAssessDamageLayer(map) {
  return L.esri.dynamicMapLayer({
    url: "https://lcmaps.lanecounty.org/arcgis/rest/services/McKenzieRebuild/RightOfEntry/MapServer",
    layers: [3],
    opacity: 1,
  });
}

// add address point layer
function addAddressLayer(map) {
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

$(createMap);
