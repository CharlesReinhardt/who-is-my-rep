/* from https://www.congress.gov/js/map/jquery.congress.memberssearchmap.js */
/* not sure what copyright !! */

/*jslint browser: true*/
/*global jQuery*/
/*jshint esnext: true */

(function ($) {
    'use strict';
    if (!$.congress) {
        $.congress = {};
    }

    $.congress.membersSearchMap = function (el, options) {

        var base = this;
        base.$el = $(el);
        base.districtHighlight = [];
        base.searchWidgetAbove = null;
        base.searchWidget = null;
        base.locationPointY = null;


        //===================================
        // POPULATE MEMBERS
        // param: members retrieved from CDG
        // test case: 'at large' - Calle 3, Cupey, San Juan, 00926, PRI
        //===================================

        base.populateDistrictMemberList = function (cdgMembers) {

            base.clearMembersList();
            base.options.outputMessages = document.getElementById("outputMessages");

            for (let j=0; j<cdgMembers.length; j++) {
                let servedTerms='', districtMember='', memberDetailUrl='',
                    memberImage='', memberFullName='', state='', info='', contacts='';
                let terms = cdgMembers[j].terms;

                if ('house' in terms) {
                    for (let k=0; k < terms.house.length; k++) {
                        servedTerms += '<li>House: ' + terms.house[k] + '</li>';
                    }
                }
                if ('senate' in terms) {
                    for (let l=0; l < terms.senate.length; l++) {
                        servedTerms += '<li>Senate: ' + terms.senate[l] + '</li>';
                    }
                }

                districtMember = cdgMembers[j].honoraryTitle +' '+ cdgMembers[j].displayNameLnFirst;
                memberDetailUrl = cdgMembers[j].memberUrl;
                memberImage = cdgMembers[j].thumbnailImageUrl;
                memberFullName = cdgMembers[j].displayNameLnFirst;
                state = cdgMembers[j].stateName;

                info = '<li class="expanded" style="display: block;">';
                info +=       j+1 + '. <span class="result-heading">';
                info += '     <a href="' + memberDetailUrl + '">' + districtMember + '</a></span>';
                info += '<div class="quick-search-member">';
                if (cdgMembers[j].thumbnailImageUrl) {
                    info += '  <div class="member-image"><img src="' + memberImage + '" alt="Picture of ' + memberFullName + '"></div>';
                    info += '  <div class="member-profile member-image-exists">';
                } else {
                    info += '  <div class="member-profile">';
                }
                info += '      <span class="result-item"><strong>State:</strong><span> ' + state + '</span></span>';

                // cdgMembers[j].district===null is Senate, ===0 is At Large
                if (cdgMembers[j].district===0) {
                    info += '      <span class="result-item"><strong>District:</strong><span> At Large </span></span>';
                } else if (cdgMembers[j].district) {
                    info += '      <span class="result-item"><strong>District:</strong><span> ' + cdgMembers[j].district + '</span></span>';
                }

                info += '      <span class="result-item"><strong>Party:</strong><span> ' + cdgMembers[j].party + '</span></span>';
                info += '      <span class="result-item"><strong>Served:</strong><span>';
                info += '      <ul class="member-served">' + servedTerms + '</ul>';
                info += '     </span></span>';

                // address & phone number
                if (cdgMembers[j].memberAddress) {
                    contacts += '<li> ' + cdgMembers[j].memberAddress + '</li>';
                }
                if (cdgMembers[j].memberPhoneNumber) {
                    contacts += '<li> ' + cdgMembers[j].memberPhoneNumber + '</li>';
                }
                if (cdgMembers[j].memberContactForm) {
                    contacts += '<li> <a href="' + cdgMembers[j].memberContactForm + '" target="_blank">Contact</a></li>';
                } else {
                    console.log(districtMember + "'s contact is not available!");
                }
                if (contacts) {
                    info += '   <span class="result-item"><strong>Contact:</strong><span>';
                    info += '   <ul class="member-served">' + contacts + '</ul></span></span>';
                }

                info += '      </div>';
                info += '   <div class="clear"></div>';
                info += '   </div>';
                info += '</li>';

                base.options.outputMessages.innerHTML += info;
                base.options.outputMessages.scrollTop = base.options.outputMessages.scrollHeight;
                info = '';
            }   // for j

        };  // end base.populateDistrictMemberList

        //===================================
        // return feature attributes values from the 117th or 116th district layer
        //===================================

        base.getPreviousDistrictAttributes = function(member)
        {
            return {
                'DISTRICTID':   member.DISTRICTID,
                'CDFIPS':       member.CDFIPS,
                'LAST_NAME':    member.LAST_NAME,
                'NAME':         member.NAME,
                'OBJECTID':     member.OBJECTID,
                'PARTY':        member.PARTY,
                'STATE_ABBR':   member.STATE_ABBR,
                'STFIPS':       member.STFIPS
            };
        }

        //===================================
        // AJAX: GET MEMBERS SERVICE INFO FROM CDG
        // param: result - an object returned from congressional feature layer query
        // param: crossStates - boolean
        //===================================

        base.getMembersFromResultedDistrict = function(result, crossStates) {
            var memberAttrs = [],
                member;

            // CDG-17348: county and zipcode searches potentially return multiple states;
            // filter them by the state we're searching for before querying the members from CDG
            var selectedStateAbbr = ''
            if (base.selectedResult.feature.attributes.Addr_type === 'Locality'
                || (base.selectedResult.feature.attributes.Addr_type === "POI" &&  base.selectedResult.feature.attributes.StAddr !== '')
                || (base.options.zipcodes.includes(base.selectedResult.feature.attributes.Addr_type) && base.selectedResult.feature.attributes.Type === '')
                || !crossStates) {
                selectedStateAbbr = base.selectedResult.feature.attributes.RegionAbbr;
            }

            if (result.features) { // from search entry
                for (var i=0; i<result.features.length; i++) {
                    member = result.features[i].attributes;
                    if (!crossStates) {
                        if (selectedStateAbbr != '' && selectedStateAbbr != member.STATE_ABBR) {
                            continue;
                        }
                    }
                    memberAttrs.push(
                        base.getPreviousDistrictAttributes(result.features[i].attributes)
                    );
                }
            } else { // from map click event
                memberAttrs = [
                    base.getPreviousDistrictAttributes(result.attributes)
                ];
            }

            base.options.memberCount = memberAttrs.length;

            // get services for member from esri plus the Senators for the state of the active district
            $.when(
                $.ajax({
                    url: '/members/get-member-terms',
                    type: "POST",
                    cache: false,
                    data: {
                        esriMembers: memberAttrs,
                    },
                    success: function (response) {
                    },
                    error: function (err) {
                        console.log("Member: " + err.statusText + "\nIs Solr up and running?");
                        base.err('Failed to obtain member terms.', err);
                    }
                })
            ).then(function(cdgMembers) {
                base.populateDistrictMemberList(cdgMembers);
                base.revealDomElementsText(memberAttrs.length);
            });
        };

        //===================================
        base.clearMembersList = function () {
            document.getElementById("outputMessages").innerHTML = '';
        }

        //===================================
        base.hideNoMembersResultsDisplay = function () {
            document.getElementById('noMembersSearchResults').style.display = 'none';
        }


        //===================================
        base.outputPageTitle = function (title) {
            $('#mapPageTitle').text(title);
        }

        //===================================
        base.outputLinkForAlertsSignUp = function (show) {
            show ? $('#alertSignUp').show() : $('#alertSignUp').hide();
        }

        //===================================
        base.outputSearchContainerText = function (show) {
            if (show) {
                $('#searchContainer').children("span").text("Enter street address for exact district:");
            }
        }

        //===================================
        base.showSearchWidgetContainer = function (show) {
            show ? $('#searchContainer').show() : $('#searchContainer').hide();
        }

        //===================================
        base.revealDomElementsText = function (districtCount) {
            if (districtCount > 1) {
                base.outputPageTitle("Your Possible Members");
                base.outputLinkForAlertsSignUp(false);
                base.outputSearchContainerText(true);
                base.showSearchWidgetContainer(true);
            } else {
                base.outputPageTitle("Your Members");
                base.outputLinkForAlertsSignUp(true);
                base.outputSearchContainerText(false);
                base.showSearchWidgetContainer(false);
            }
        }

        //===================================
        // Ensure a SEARCH WIDGET EXISTS
        // populate a search widget if there isn't one above or within the map
        //===================================

        base.ensureWidgetExists = function () {
            if (!base.view.ui.find('widget-within') && !base.searchWidget) {
                base.populateSearchWidget();
            }
        }


        //===================================
        // CLEAR ALL ITEMS SHOWING ON THE MAP
        //===================================

        base.clear = function() {
            if ($('#warningMsg').length){
                $('#warningMsg').remove();
            }

            if ($('#alertSignUp').length) {
                base.outputLinkForAlertsSignUp(false);
            }

            // remove both the street popup n black dot symbol from base view
            if (base.view.popup) {
                base.view.closePopup();
            }

            base.view.allLayerViews.items.filter(function (item) {
                if (item.layer.id === 'streets-navigation-vector-base-layer') {
                    base.view.graphics.remove(item.view.graphics.items[0]);
                }
            });

            // remove graphics from graphic layer
            base.locationPointGraphicsLayer.removeAll();

            // remove the highlight from active district
            if (base.districtHighlight) {
                base.districtHighlight.forEach(function(highlight) {
                    highlight.remove();
                });
                base.districtHighlight = [];
            }

            // also clear member list on the right of map
            base.clearMembersList();

            // Hide the no results div
            base.hideNoMembersResultsDisplay();
        };

        //===================================
        // OUTPUT ERROR MESSAGE
        // param: msg - customized message string
        // param: error - an object thrown from the view, feature layers, locator, or ajax request
        //===================================
        base.err = function (msg, error = undefined) {
            console.log(error);
            let errMsg = '';

            if ('undefined' !== typeof error) {
                if ('undefined' != typeof error.name && 0 !== error.name.length) {
                    errMsg = error.name;
                }
                if ('undefined' != typeof error.message && 0 !== error.message.length) {
                    errMsg += ' ' + error.message;
                }
                if ('undefined' !== typeof error.details) {
                    if (error.details.httpStatus === 498) {
                        errMsg += '<br />You may need to renew API key.';
                    } else if (error.details.httpStatus === 500) {
                        errMsg += '<br />The ArcGIS Server error, please try again later.';
                    } else if (error.details.httpStatus === 404) {
                        errMsg += '<br />Network error, please try again later.';
                    }
                }
            } else {
                errMsg = msg;
            }

            base.outputLinkForAlertsSignUp(false);

            if (errMsg) {
                base.$el.before('<div id="warningMsg"><span>'+ errMsg +'</span></div>');
            } else {
                $('#district-map-view').hide();
            }
        };

        //===================================
        base.padNumber = function (num, size) {
            var s = num.toString();
            while (s.length < size) {
                s = "0" + s;
            }
            return s;
        };

        //===================================
        // ADD POINT GRAPHIC TO MAP (for address)
        //===================================

        base.drawPoint = function(x, y) {
            var point = {
                type: "point",
                longitude: Number(x),
                latitude: Number(y)
            },
                symbol = {
                    type: "picture-marker",
                    url: "/img/location-pin30x30.png",
                    width: "30px",
                    height: "30px"
                },
                graphic = new base.Graphic({
                    geometry: point,
                    symbol: symbol
                });

            base.locationPointGraphicsLayer.removeAll();
            base.locationPointGraphicsLayer.add(graphic);
            //~ base.locationPointGraphicsLayer.add('asdf');
        };

        //===================================
        // SETS VIEW LAYER to the target
        //===================================

        base.goTo = function (extent) {
            if (base.isAddressCategory()) {
                base.drawPoint(extent.center.longitude, extent.center.latitude);
            }
            base.view.when(function() {
                let opts = {
                    duration: 500  // Duration of animation will be 5 seconds
                };
                base.view.goTo(extent.expand(-1.5), opts);
            });
        };

        //===================================
        //   HIGHLIGHT the DISTRICT LAYER
        // param: feature layer view
        // param: features from the selected district layer
        //===================================

        base.hightlightDistrictLayer = function (layerView, features) {
            var uniqueObjectId = base.featureLayerDistricts.objectIdField;
            layerView.highlightOptions = base.options.highlightOptions;
            if (Array.isArray(features)) {
                //~ // highlight all districts that returned from esri
                var highlight = null;
                for (var i=0; i<features.length; i++){
                    highlight = layerView.highlight([features[i].attributes[uniqueObjectId]]);
                    base.districtHighlight.push(highlight);
                }
            } else {
                base.districtHighlight = [layerView.highlight([features.attributes[uniqueObjectId]])];
            }
        };

        //===================================
        // GET EXTENT FROM THE SELECTED SEARCH RESULT
        // return the extent which is constructed based on the coordinates from the geocode search
        //===================================

        base.getExtentFromSelectedResult = function () {
            return new base.Extent({
                xmin: base.selectedResult.feature.attributes.Xmin,
                xmax: base.selectedResult.feature.attributes.Xmax,
                ymin: base.selectedResult.feature.attributes.Ymin,
                ymax: base.selectedResult.feature.attributes.Ymax,
            });
        };

        //===================================
        // FETCH FEATURES BY STATE
        // param: features from the district layer
        // return the list of features that have the same state as the search term
        //===================================
        base.fetchFeaturesByState = function (features)
        {
            var newFeatures = [], j=0;
            for (var i=0; i<features.length; i++) {
                if (features[i].attributes.STATE_ABBR == base.selectedResult.feature.attributes.RegionAbbr) {
                    newFeatures[j] = features[i];
                    j++;
                }
            }
            return newFeatures;
        };

        //===================================
        //  isAddressCategory
        //      - verify if the search term falls into the valid "address" category
        //===================================
        base.isAddressCategory = function () {
            if (base.options.addrTypesAddresses.includes(base.selectedResult.feature.attributes.Addr_type) ||
                (base.selectedResult.feature.attributes.Addr_type === "POI" &&
                    (base.selectedResult.feature.attributes.StAddr && base.selectedResult.feature.attributes.StAddr !== '')) ||
                (base.selectedResult.feature.attributes.Addr_type === 'Locality' &&
                    ['Block', 'Sector', 'Neighborhood', 'Village'].includes(base.selectedResult.feature.attributes.Type))
            ) {
                return true;
            }
            return false;
        }

        //===================================
        // SKETCH the DISTRICT LAYER via
        //      - Draw the district layer with the extent retrieved from the intersecting search point
        // param: layerView - the district feature layer view
        // param: polygonGeometry - the coordinates from either zipcode or county layer search result
        //===================================

        base.sketchDistrictLayerViaExtent =  function (layerView, polygonGeometry) {
            base.featureLayerDistricts.queryFeatures({
                geometry: polygonGeometry,
                spatialReference: 'intersects',
                returnGeometry: true,
                outFields: ["*"]
            }).then(fs => {

                base.getMembersFromResultedDistrict(fs);
                base.populateSearchWidget(base.options.memberCount);

                var features = fs.features;
                // Confine the search results to a specified area with the searchExtent parameter.
                if ((features && features[0] && features[0].attributes) && features.length < 100) {
                    if (polygonGeometry.type === 'extent') {
                        base.goTo(polygonGeometry);
                    } else if (polygonGeometry.extent) {
                        base.goTo(polygonGeometry.extent);
                    } else {
                        base.goTo(polygonGeometry);
                    }
                    base.hightlightDistrictLayer(layerView, base.fetchFeaturesByState(features));

                    //return fs.features;
                } else {
                    base.err("No Members found. Please try a different search.");
                }
            }).catch(function(error) {
                    base.err('Unable to query the district feature layer.', error);
            });
        };

        //===================================
        // SKETCH the DISTRICT LAYER via query params
        // param: extent - extent obj from an address
        // param: layerView - the district feature layer view
        // param: searchBy - eg "state" or blank for other
        // param: crossstates - boolean
        //===================================

        // note: The features visible in a view are accessed via the LayerView n FeatureLayerView, not the FeatureLayer
        base.sketchDistrictLayerViaQryParams = function (extent, layerView, searchBy, crossStates=true) {
            var queryParams = null;
            queryParams = base.featureLayerDistricts.createQuery();

            if (extent === null && searchBy === 'state') {
                queryParams.where = "state_abbr='" + base.searchTerm + "'";
            } else {
                queryParams.inSR = extent.spatialReference;
                queryParams.geometryType = "esriGeometryEnvelope";
                queryParams.spatialRel = "esriSpatialRelIntersects";
                queryParams.geometry = extent;
                queryParams.distance = 0.1;
                queryParams.units="esriSRUnit_StatuteMile";
            }
            queryParams.f = "json";
            queryParams.outFields = "*";
            queryParams.returnGeometry = true;
            queryParams.returnCentroid = true;

            base.featureLayerDistricts.queryFeatures(queryParams)
             .then(function (districtResponse) {
                if (districtResponse.features.length) {
                    var features = districtResponse.features;
                    base.featureLayerDistricts.popupEnabled = false;

                    base.getMembersFromResultedDistrict(districtResponse, crossStates);
                    base.populateSearchWidget(base.options.memberCount);

                    if ((features && features[0] && features[0].attributes) && features.length < 100) {
                        // Don't use the district layer's extents when drawing small "balloon" icons because
                        // the little "balloon" icon should land on the view layer, not the district layer
                        extent ?
                            base.goTo(extent) :
                            base.goTo(base.getExtentFromSelectedResult());

                        // highlight all districts that returned from esri if 'crossState' is false else
                        // narrow the list of features to only those with the same state as the search term
                        base.hightlightDistrictLayer(
                            layerView,
                            crossStates ? features : base.fetchFeaturesByState(features)
                        );

                    } else {
                        base.err("No Members found. Please try a different search.");
                    }
                } else {
                    base.err("No matching district found. Please try a different search.");
                }
            })
            .catch(function(error){
                base.err('Unable to query the district feature layer.', error);
            }); // end district feature
        };

        //===================================
        // isBigCity
        // determine if we're searching on a "big" city or not.
        // When searching bigish cities, we'll use the county layer which
        // we think will provide more accurate results than an extent search.
        //===================================

        base.isBigCity = function () {
            var width = Math.abs(Math.abs(base.selectedResult.feature.attributes.Xmin) - Math.abs(base.selectedResult.feature.attributes.Xmax)),
                height = Math.abs(Math.abs(base.selectedResult.feature.attributes.Ymin) - Math.abs(base.selectedResult.feature.attributes.Ymax));
            if (width > 0.05 || height > 0.05) {
                return true;
            }
            return false;
        };

        //===================================
        // locatorParams
        // param: searchValue - an object; it could be an address or a location coordinates/points
        // ret a list of params to feed to the locator service's methods: addressToLocations and locationToAddress
        // ref: https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-locator.html#addressToLocations
        //===================================

        base.locatorParams = function(searchValue) {
            let keyName = searchValue.singleLine ? 'address' : 'location';
            return {
                apiKey: base.apiKey,
                [keyName]: searchValue,
                countryCode: base.options.countryCode,
                locationType: base.options.rooftop,
                categories: base.geocodingCategories,
                outFields: ["*"],
                // narrow the search area:
                maxLocations: 1
                // localSearchOptions: base.options.searchOptions,  // this prop no longer valid in SDK JS 4.25
                // location:
                // outSpatialReference:
                // searchExtent:
            }
        };

        //===================================
        // RELOCATE DISTRICT via REST LOCATOR EXTENT
        //  - This fall back function is called when the Zip or County layer cannot obtain geometry coordinates from the search term
        // param: layerView from .whenLayerView()
        // ref: https://developers.arcgis.com/rest/geocode/api-reference/geocoding-find-address-candidates.htm#
        // (/findAddressCandidates?SingleLine=&)
        // ref: https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-locator.html
        //===================================

        base.revisitSearchViaLocatorExtent = function (layerView) {
            var address = {
                "singleLine": base.searchTerm,
                regionAbbr: base.selectedResult.feature.attributes.RegionAbbr,
                subRegion: base.selectedResult.feature.attributes.Subregion.replace(/'/g, "''")
            };

            base.Locator.addressToLocations(
                base.options.memberMapLocatorUrl,
                base.locatorParams(address)
            )
            .then(function(response){
                if (response[0].extent != null) {
                    // filter by score==100
                    var exactMatch = 0, extent = {};
                    for(var i=0; i<response.length; i++) {
                        if (response[i].score == 100) {
                            exactMatch = 1;
                            extent = response[i].extent;
                            break;
                        }
                    }
                    // Confine the search results to a specified area via Extent coordinates
                    base.sketchDistrictLayerViaQryParams(exactMatch ? extent : response[0].extent, layerView, null, true);
                } else {
                    base.err("Failed to locate the coordinates for search term '" + base.searchTerm + "'");
                }
            })
            .catch(function(error) {
                base.err("Unable to find location candidate for search term '" + base.searchTerm + "'", error);
            }); // end locator
        };

        //===================================
        // LOCATE DISTRICT BY THE INPUT ADDRESS
        // param: layerView from .whenLayerView()
        // ref: https://developers.arcgis.com/rest/geocode/api-reference/geocoding-find-address-candidates.htm#
        // (/findAddressCandidates?SingleLine=)
        //===================================

        base.locateDistrictByAddress = function (layerView, crossStates) {
            var address = {
                "singleLine": base.searchTerm,
            };

            base.Locator.addressToLocations(
                base.options.memberMapLocatorUrl,
                base.locatorParams(address)
            )
            .then(function(response){
                if (response[0].extent != null) {
                    // note (CDG-17348): usually an address will return 1 entry. If more than one is returned,
                    // then most likely this search term crosses states
                    base.sketchDistrictLayerViaQryParams(response[0].extent, layerView, null, crossStates);
                } else {
                    base.err("Failed to locate the coordinates for search term '"+ base.searchTerm +"'");
                }
            })
            .catch(function(error) {
                base.err('Unable to find location candidate for address: ' + address.singleLine, error);
            }); // end locator
        };

        //===================================
        // LOCATE THE INTERSECTING POINTS via the COUNTY layer
        //   https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-support-AddressCandidate.html
        //===================================

        base.locateDistrictByCounty = function (layerView) {
            // some counties have apostrophe in their name which will cause query issue
            // hence replacing apostrophe with 2 single quotes before the query to avoid
            // query error thrown from the county layer
            var county = base.selectedResult.feature.attributes.Subregion.replace(/'/g, "''");
            var state = base.selectedResult.feature.attributes.Region;

            base.featureLayerCounty.queryFeatures({
                where: "NAME='" + county + "' AND STATE_NAME = '" + state + "'",
                units: "esriSRUnit_Foot",
                outFields: ["NAME", "STATE_NAME", "STATE_FIPS", "COUNTY_FIPS", "FIPS", "OBJECTID"],
                returnGeometry: true
            }).then(
                function (result) {
                    if (result.features.length) {
                        base.sketchDistrictLayerViaExtent(layerView, result.features[0].geometry);
                    } else {// falls back to call this function if no feature info returned from the if case above; eg: "Fairfax, VA", "City of Virginia Beach, VA"
                        base.revisitSearchViaLocatorExtent(layerView);
                    }
                },
                function (err) {
                    base.err('Unable to query the County feature layer.', err);
                }
            );
        };

        //===================================
        // LOCATE DISTRICT BY GEOMETRY POINT
        //===================================
        base.locateAddressViaXYCoordinates = function (layerView) {
            // get the address nearest to the requested location point
            if (base.selectedResult) {
                var mapPoint = new base.Point ({
                    type: "point",
                    longitude: base.selectedResult.feature.attributes.X,
                    latitude: base.selectedResult.feature.attributes.Y
                });

                // do a proximity search via reverseGeocode operation to find
                // an address or place that is closes to the location
                base.Locator.locationToAddress(
                    base.options.memberMapLocatorUrl,
                    base.locatorParams(mapPoint)
                )
                .then(function(response){
                    if (response.address) {
                        if (response.attributes.LongLabel) {
                            base.searchTerm = response.attributes.LongLabel;
                        } else if ( response.attributes.Match_addr) {
                            base.searchTerm = response.attributes.Match_addr;
                        } else {
                            base.searchTerm = response.address;
                        }
                        base.locateDistrictByAddress(layerView, false); // CDG-17348; added boolean false for AC #6, #7
                    } else {
                        //no address found
                        base.err('Unable to locate address from this map location (point).' );
                    }
                })
                .catch(function(error) {
                    base.err('Unable to find candidate address for the specified locator map points.', error);
                });
            }
        }

        //===================================
        // LOCATE THE INTERSECTING POINTS via the ZIP CODE layer
        //===================================

        base.locateDistrictByZip = function (layerView) {
            var x = base.selectedResult.feature.attributes.X,
                y = base.selectedResult.feature.attributes.Y,
                zipCode = base.selectedResult.feature.attributes.Postal;

            base.featureLayerZipcode.queryFeatures({
                where: "ZIP_CODE='" + zipCode + "'",
                outFields: ["*"],
                returnGeometry: true
            })
            .then(
                function (result) {
                    if (result.features.length) {
                        base.sketchDistrictLayerViaExtent(layerView, result.features[0].geometry);
                    } else {
                        // not able to find an address from the Zip feature layer, falls back to search again using the locator's extent instead;
                        // eg: "Fairfax, VA" OR ZIP "13107, MAPLE VIEW, NY"
                        // NOTE: 13107 ZIP CODE is not found in Esri's USA_ZIP_Codes_2016 feature layer
                        base.revisitSearchViaLocatorExtent(layerView);
                    }
                },
                function (err) {
                    base.err('Unable to query the ZipCode feature layer.', err);
                }
            );
        };



        //===================================
        // START the MAP SEARCHES
        // param: layerView - the district feature layer
        // ref: https://developers.arcgis.com/rest/geocode/api-reference/geocoding-reverse-geocode.htm
        // ref: https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-locator.html
        // ref: https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-support-AddressCandidate.html
        // ref: https://developers.arcgis.com/rest/geocode/api-reference/geocoding-service-output.htm#ESRI_SECTION1_42D7D3D0231241E9B656C01438209440 (addr_type)
        //===================================

        base.startMapSearches = function (layerView=null) {

            switch (base.selectedResult.feature.attributes.Type) {
                case 'State or Province':
                    // not recommend to search with extent for state/province
                    base.searchTerm = base.selectedResult.feature.attributes.RegionAbbr;
                    base.sketchDistrictLayerViaQryParams(null, layerView, 'state', false);
                break;
                case 'City':
                    if (base.isBigCity()) {
                        //there's no city layer so we use the county for bigish cities
                        base.locateDistrictByCounty(layerView);
                    } else {
                        base.locateDistrictByAddress(layerView, false);
                    }
                break;
                case 'County':
                    //there's no city layer so we use the county
                    base.locateDistrictByCounty(layerView);
                break;
                default:
                    // a full address search
                    if (base.isAddressCategory()) {
                        base.locateDistrictByAddress(layerView, true);
                    } else if (
                        base.options.zipcodes.includes(base.selectedResult.feature.attributes.Addr_type) &&
                        base.selectedResult.feature.attributes.Type === ''
                    ) {
                        //do a zip code intersect search; note: zip code searches have emtpy type
                        base.locateDistrictByZip(layerView);
                    } else {
                        // eg. The Mall Washington DC
                        base.locateAddressViaXYCoordinates(layerView);
                    }
                break;
            }
        };


        //===================================
        // VALIDATE SEARCH-RESULT event
        //      - the event below fires when a search result is selected
        // param: evt - an object that holds the selected search result data
        //===================================

        base.validateSelectResultEvent = function (evt) {
            // set global values
            base.selectedResult = evt.result;
            base.searchTerm = base.selectedResult.feature.attributes.LongLabel ?? base.selectedResult.name;

            // for address ok to take first one; none address type take the X, Y coordinates from the geometry
            if (!base.selectedResult.feature.attributes.X) {
                base.selectedResult.feature.attributes.X = base.selectedResult.feature.geometry.longitude;
                base.selectedResult.feature.attributes.Y = base.selectedResult.feature.geometry.latitude;
            }

            base.clear();

            // wait for view to load before carry on with other activities on map
            // layerView == the layer for the featureLayerDistricts, 'congressional-district-layer'
            base.view.when(function(){
                base.view.whenLayerView(base.featureLayerDistricts)
                    .then(function (layerView) {
                        base.startMapSearches(layerView);
                }).catch(function(error) {
                    base.err('Load failed. The district layer is not ready yet.', error);
                });
            }).catch(function(error) {
                base.err('Load failed. The map view is not ready yet.', error);
                base.$el.hide();
            });
        };

        //===================================
        // VALIDATE SEARCH-COMPLETE event
        //      - the event below fires when a search is completed and a result is returned
        // param: evt - an object that holds the search result data
        //===================================

        base.validateSearchCompleteEvent = function(evt) {
            let errMsg = '';
            if (typeof evt !== 'undefined') {
                if (evt.numErrors) {
                    if (evt.errors[0]['error']['name'] !== '') {
                        errMsg = evt.errors[0]['error']['name'];
                    }
                    if (evt.errors[0]['error']['message'] !== '') {
                        errMsg += ' ' + evt.errors[0]['error']['message'];
                    }
                    if (evt.errors[0]['error']['message'] === 'Invalid Token') {
                        errMsg += '<br \> You may need to renew API key.';
                    } else {
                        errMsg += '<br \> There were no results found for \"' + evt.searchTerm + '\"';
                    }
                } else if (!evt.searchTerm && !evt.numResults) {
                    errMsg = 'Please enter a search term.';
                } else if (!evt.errors.length && !evt.numResults) {
                    // search term not found
                    errMsg = 'There were no results found for \"' + evt.searchTerm + '\"';
                }
            }

            if (errMsg) {
                base.clear();

                // hide the error div that comes with Esri search widget
                $('.esri-search__warning-menu').hide();

                // show customized error message at top of map
                base.$el.before('<div id="warningMsg"><p><strong>No results</strong></p><p>' + errMsg + '</p></div>');
                base.$el.closest('.row').find('#noMembersSearchResults').show();
            }
        };

        //===================================
        // Map's Search Sources
        // param memberCount - number of district member found; it helps to determine where to place the search widget
        //===================================

        base.searchSources = function(memberCount) {
            let containerId = '',
                widgetLocation = 'Address Lookup (inside map)';

            // create the search widget and hook it to the div#member-search-widget element
            // else the widget will populate inside the map's top right corner
            if (memberCount > 1) {
                widgetLocation = 'Address Lookup (above map)';
                containerId = 'search-widget';
            }

            return new base.Search({
                id: 'widget-within',
                view: base.view,
                container: containerId ?? '',
                sources: [
                    {
                        name: widgetLocation,
                        placeholder: "Find address or place",
                        apiKey: base.apiKey,
                        url: base.options.memberMapLocatorUrl,
                        singleLineFieldName: "SingleLine",
                        countryCode: base.options.countryCode,
                        langCode: base.options.english,
                        categories: base.geocodingCategories,
                        locationType: base.options.rooftop,
                        outFields: ["*"],
                        displayField: "",
                        maxResults: 6,
                        maxSuggestions: 6,
                        popupEnabled: false,
                        resultGraphicEnabled: false
                    },
                ],
                includeDefaultSources: false,
            });
        }

        //===================================
        // populateSearchWidget
        // param: memberCount - number of districts found; it helps to determine where to place the search widget
        //===================================

        base.populateSearchWidget = function (memberCount) {
            // start from scratch on every search request

            // remove widget that was in the top-right corner of the map
            if (base.view.ui.find('widget-within')) {
                base.view.ui.remove(base.searchWidget);
            }

            // search widget exists after the initialization
            if (base.searchWidget) {
                // remove widget that was located above the map
                if (base.searchWidget.container.id) {
                    $('#search-widget')[0].firstChild.remove();
                    base.showSearchWidgetContainer(false);
                }
                base.searchWidget.clear();
            }

            // initialize widget
            base.searchWidget = base.searchSources(memberCount);

            // Wire up Search Widget event listeners
            base.searchWidget.on("search-clear", function(evt){
                base.clear();
            });
            base.searchWidget.on("search-complete", function (evt) {
                base.validateSearchCompleteEvent(evt);
            });
            base.searchWidget.on("select-result", function (evt) {
                base.validateSelectResultEvent(evt);
            });

            // positioning the search widget form
            if (memberCount > 1) {
                // already hook the widget to div that's above the district-map, show it
                base.showSearchWidgetContainer(true);
            } else {
                base.view.ui.add(base.searchWidget, {position: "top-right"});
            }
        };

//////////////////////////////////////////////////////
        /*
         * init
         *
         * @return null
         */
        base.init = function () {
            base.options = $.extend({}, $.congress.membersSearchMap.defaultOptions, options);
            require([
              "esri/Map",
              "esri/views/MapView",
              "esri/Graphic",
              "esri/layers/GraphicsLayer",
              "esri/layers/FeatureLayer",
              "esri/widgets/Search",
              "esri/rest/locator",
              "esri/geometry/Point",
              "esri/geometry/Extent"
            ], function(Map, MapView, Graphic, GraphicsLayer, FeatureLayer, Search, locator, Point, Extent) {
                // attaching all ersi objects to base for easy access
                base.Map = Map;
                base.MapView = MapView;
                base.Graphic = Graphic;
                base.GraphicsLayer = GraphicsLayer;
                base.FeatureLayer = FeatureLayer;
                base.Search = Search;
                base.Locator = locator;
                base.Point = Point;
                base.Extent = Extent;

                // values ref: https://doc.arcgis.com/en/arcgis-online/reference/geocode.htm
                // note: per doc from the https://developers.arcgis.com/rest/geocode/api-reference/geocoding-service-output.htm#ESRI_SECTION1_42D7D3D0231241E9B656C01438209440:
                // The SubAddress match level is the most accurate, followed by PointAddress and StreetAddress.
                // The StreetName match level can be accurate if the street is a short segment, but less so if it is a long segment.
                base.options.zipcodes = ['Postal', 'PostalLoc', 'PostalExt'];
                base.options.addrTypesAddresses = ['PointAddress', 'StreetAddress', 'SubAddress', 'StreetName', 'StreetMidBlock'];
                base.options.memberCount = 0;

                base.geocodingCategories = base.options.geocodingCategories.split(", ");
                base.options.countryCode = 'US';
                base.options.english = 'EN';
                base.options.rooftop = 'rooftop';   // or 'street'; only two choices
                base.options.searchOptions = {
                    minScale: 300000,       // Location search will be performed when the map scale is less than the specified value. The default minScale is 15,000
                    distance: 500           // Specify a search distance for the location search. The default value is 12,000 meters
                };
                base.options.highlightOptions = {
                    fillOpacity: 0.05,
                    haloColor: "#000"
                };

                // copy & paste the "passed-in" results and terms to local variables.
                base.selectedResult = base.options.selectedResult;
                base.searchTerm     = base.options.searchTerm;

                // "long-lived" key; it expires on 7/11/2025; ask LOC ArcGIS Online Admin, James Crawford, to refresh the key
                base.apiKey = '';

                //===================================
                // FETCH API KEY
                //===================================
                $.when(
                    $.ajax({
                        url: "/members/get-map-api-key",
                        type: "POST",
                        success: function(response) {
                        },
                        error: function() {
                            base.err('Failed to obtain the api key for locator search.');
                        }
                    })
                ).then(function(key) {
                    base.apiKey = key;
                });


                //state layer - we're not using this layer atm
                // base.usStatelayer = new base.FeatureLayer({
                //     url: "https://services1.arcgis.com/o90r8yeUBWgKSezU/arcgis/rest/services/US_Territories/FeatureServer",
                // });

                //county layer
                base.featureLayerCounty = new base.FeatureLayer({
                    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_Census_Counties/FeatureServer/0',
                });

                //zip code layer
                base.featureLayerZipcode = new base.FeatureLayer({
                    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_ZIP_Codes_2016/FeatureServer/0"
                });

                //USA house distrct layer

                // TODO: for testing only, remove and replace url below when done teting
                // Note - 01/29/2025:
                //      Census layer + 118th district layer in Test, Stg, and Prod
                //      Census layer + 119th district layer in Dev

                const URL_DISTRICT_LAYER_118TH = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_118th_Congressional_Districts_all_territories/FeatureServer/0';
                const URL_DISTRICT_LAYER_119TH = base.options.memberDistrictLayerUrl + "/0";

                // https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_118th_Congressional_Districts_all_territories/FeatureServer
                base.featureLayerDistricts = new base.FeatureLayer({
                    // url: base.options.memberDistrictLayerUrl + "/0",
                    url: base.options.env === 'dev' ?  URL_DISTRICT_LAYER_119TH : URL_DISTRICT_LAYER_118TH,
                    id: "congressional-district-layer",
                    outFields: ["*"],
                    popupEnabled: false,
                    defaultPopupTemplateEnabled: false,
                    visible: true,
                    renderer: {
                        type: "simple",
                        symbol: {
                            type: "simple-fill",
                            color: [153, 153, 153, 0.2],   // 0 is 100% transparent, 1 is completely opaque (not transparent)
                            outline: {
                                color: "#333",             // border for all
                            }
                        },
                    },
                });

                //Graphics Layer
                base.locationPointGraphicsLayer = new base.GraphicsLayer({id: "pgn_gl"});

                //the map
                base.map = new base.Map({
                    basemap: "streets-navigation-vector",
                });

                // Add the layers that we want drawn on the map
                base.map.layers.addMany([
                    base.featureLayerDistricts,
                    base.locationPointGraphicsLayer
                ]);

                // map add to view with our static options
                base.view = new base.MapView({
                    container: "district-map-view",
                    map: base.map,
                    center: [-97.5407, 38.4360], // center point of USA map: Longitude, latitude
                    zoom: 4,                     // how large or small the contents of a map appear in a map view; 0 (global view) and 23 (very detailed view)
                    popupEnabled: false,
                    ui: {
                        components: ["attribution", "zoom"]
                        // components: ["zoom"]
                    },
                    // don't allow zoom in less than 3
                    constraints: {
                        minZoom: 3,
                        rotationEnable: false,
                        snapToZoom: false
                    },
                    // fill and highlight an active district
                    highlightOptions: base.options.highlightOptions
                });


                //===================================
                // MAP VIEW IS READY - on first load
                //===================================

                // wait for view to load before carry on with other activities on map
                // layerView == the layer for the featureLayerDistricts, 'congressional-district-layer'
                base.view.when(function(){
                    base.view.whenLayerView(base.featureLayerDistricts)
                      .then(function (layerView) {
                        base.startMapSearches(layerView);
                        base.ensureWidgetExists();
                    }).catch(function(error) {
                        base.err('Load failed. The district layer is not ready yet.', error);
                    });
                }).catch(function(error) {
                    base.err('Load failed. The map view is not ready yet.', error);
                    base.$el.hide();
                });


                //===================================
                // MAP CLICK EVENT
                // REF: https://developers.arcgis.com/javascript/latest/api-reference/esri-views-MapView.html#hitTest
                // REF: https://developers.arcgis.com/javascript/latest/api-reference/esri-views-layers-FeatureLayerView.html#highlight
                //===================================

                // get screenpoint from view's click event
                base.view.on("click", (event) => {
                    // Search for all features only on included layers at the clicked location
                    base.view.hitTest(event, {include: base.featureLayerDistricts}).then((graphicHits) => {
                        if (graphicHits.results.length) {
                            // refresh member list to reflect the newly acquire district
                            base.getMembersFromResultedDistrict(graphicHits.results[0].graphic);

                            base.view.whenLayerView(graphicHits.results[0].graphic.layer).then(function (layerView) {
                                // fill and highlight an active district once the layer view is ready
                                base.hightlightDistrictLayer(layerView, graphicHits.results[0].graphic);
                            });

                            base.populateSearchWidget(1);
                        }
                    })
                });
            }); // end esri require
        }; // end init()

        base.init();
    };

    $.congress.membersSearchMap.defaultOptions = {
        width:                          '300px',
        height:                         '300px',
        memberMapLocatorUrl:            'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer',
        searchTerm:                     null,
        Xmin:                           0,
        Xmax:                           0,
        Ymin:                           0,
        Ymax:                           0,
        outputMessages:                 ''
    };

    $.fn.congress_membersSearchMap = function (options) {
        return this.each(function () {
            var ft = new $.congress.membersSearchMap(this, options);
            $(this).data('congress.membersSearchMap', ft);
        });
    };

    $.fn.getcongress_membersSearchMap = function () {
        this.data('congress.membersSearchMap');
    };

}(jQuery));
