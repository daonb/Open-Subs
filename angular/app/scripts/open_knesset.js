'use strict';

(function() {

angular.module('app')
  .factory('OPEN_KNESSET', function ($resource, $http, SETTINGS, $q, USER,
                                     $window, $location) {

    var _getCandidatesPage = function(relurl, candidates) {
      if (!candidates) candidates = {};

      function initCandidate(c) {
        if (!c.img_url && c.mk)
          c.img_url = c.mk.img_url;
        if (c.img_url && c.img_url.slice(11,18) == 'knesset')
          c.img_url = 'https' + c.img_url.slice(4);

        candidates[c.id] = c;
        if (!c.hasOwnProperty('donor') ||  !c.hasOwnProperty('related')) {
          c.donor = [];
          c.related = [];
          for (var i=0; i < c.relations.length; i++){
            var r = c.relations[i];
            c[r.relationship].push(r.with_person);
          }
        }
        var fbPage = "";
        if (!c.links)
          c.links = [];
        if (c.mk)
          c.links = c.links.concat(c.mk.links);
        if (c.links) {
          for (i=0; i < c.links.length; i++) {
            if (c.links[i]["url"].search("facebook.com") > 0) {
              fbPage = c.links[i]["url"];
              break;
            }
          };
        }
        if (fbPage != "") {
          // get the page id from the url
          var parts = fbPage.split('/');
          c.fb_id = parts[parts.length - 1];
        }
        else
          c.fb_id = "";
        // get the TheMarker's info
        c.themarker = {};
        for (i=0; i < c.external_info.length; i++) {
          var d = c.external_info[i];
          if (d.source == 'TheMarker')
            c.themarker[d.key] = d.value;
        }

      };

      return $q(function(resolve) {
        var url = SETTINGS.offline ? (relurl.indexOf('limit') === -1 ? '/fakedata/persons.json' : '/fakedata/persons2.json') : SETTINGS.backend+relurl;
        $http.get(url, {cache: true, params: {roles__org: "הבחירות לכנסת ה-20"}}).success(function(data) {
          angular.forEach(data.objects, initCandidate);
          if (data.meta.next) {
            _getCandidatesPage(data.meta.next, candidates).then(function() {
              resolve(candidates);
            });
          } else {
            resolve(candidates);
          }
        });
      });
    };

    var OPEN_KNESSET = {
      get_person: function(id) {
        var uri = SETTINGS.backend+'/api/v2/person/';
        if (typeof id == "string") {
          var re = new RegExp("\/api\/v2\/person\/([0-9]+)\/");
          var m = id.match(re);
          if (m)
            uri += m[1]+'/'
          else
            uri += id;
        }
        else if (id.constructor == Array)
            uri += '?id__in='+id.join(',');

        //TODO:
        return $q(function(resolve, reject) {
          OPEN_KNESSET.get_candidates().then(function(candidates) {
            if (candidates[id]) {
              resolve(candidates[id]);
            } else {
              if (SETTINGS.offline) {
                // TODO: implement for persons which are not candidates
                if (OPEN_KNESSET.hasOwnProperty('relations')) {
                  var r = [];
                  for (var i=0; i<id.length; i++)
                    r.push(OPEN_KNESSET.relations[id[i]])
                  resolve(r);
                }
                else {
                  $http.get('/fakedata/relations.json').then(function (data) {
                    data = data.data.objects
                    OPEN_KNESSET.relations = {};
                    for (var i=0; i<data.length; i++) {
                      var p = data[i];
                      OPEN_KNESSET.relations[p.id] =p;
                    }
                    var r = [];
                    for (var i=0; i<id.length; i++)
                      r.push(OPEN_KNESSET.relations[id[i]])
                    resolve(r);
                  });
                }
             }
             else {
                $http.get(uri).success(function(data) {
                  resolve(data.objects);
                });
              }
            }
          })
        })
      },
      get_committee: function(id) {
        return $q(function(resolve, reject) {
          for (var i = 0; i < COMMITTEES_DATA.length; i++) {
            if (COMMITTEES_DATA[i].id == id) {
              resolve(COMMITTEES_DATA[i]);
              return;
            }
          }
          reject();
        });
      },
      get_committees: function() {
        return $q(function(resolve) {
          for (var i = 0; i < COMMITTEES_DATA.length; i++) {
            var c = COMMITTEES_DATA[i],
                electedId = eval($window.sessionStorage.getItem('chair'+c.id));
            if (electedId)
              c.electedId = electedId;
          }
          resolve(COMMITTEES_DATA);
        });
      },
      get_candidates: function () {
        return $q(function(resolve, reject) {
          if (OPEN_KNESSET.candidates) {
            resolve(OPEN_KNESSET.candidates);
          } else {
            _getCandidatesPage('/api/v2/person/').then(function(candidates) {
              OPEN_KNESSET.candidates = candidates;
              resolve(candidates);
            });
          }
        });
      },
      storeChairSelection: function(committee_id, candidate_id) {
        if (SETTINGS.storeElections) {
          USER.login().then(function(res) {
            // accessToken expiresIn userID
            $http.post(SETTINGS.backend + '/users/fbstore/opensubs/', {
              'signedRequest': res.authResponse.signedRequest,
              'accessToken': res.authResponse.accessToken,
              'k': 'chairSelection'+committee_id,
              'v':candidate_id
            });
          }, function() {
            //$location.path('/error/login'+$location.path());
          })
        }
      },
      teamUrl: function() {
        // returns an object with `rel` and `abs` urls
        var r = {rel: "/key/"},
            n = 0,
            port = $location.port();

        for (var i = 0; i < COMMITTEES_DATA.length; i++) {
          var c = COMMITTEES_DATA[i],
              electedId = $window.sessionStorage.getItem('chair'+c.id);
          // if null
          electedId = electedId ? electedId : 0;
          //if "null"
          electedId = electedId!="null" ? electedId : 0;
          if (electedId != 0)
            n ++;
          var cand_code = ('00' + parseInt(electedId).toString(36)).substr(-3);
          r.rel += cand_code;
          }
        r.abs = (port != 443 && port != 80)?
          'https://'+ $location.host()+':'+port+r.rel:
          'https://'+ $location.host()+r.rel;
        r.n = n;
        return r
      }
    };
    return OPEN_KNESSET;
  })
;

var COMMITTEES_DATA = [
  {
    id: 2,
    "absolute_url": "/committee/2/",
    "description": "ועדת הכלכה עוסקת בנושאים הקשורים למסחר ותעשיה, תחבורה, תעופה, זכיונות המדינה ואפוטרופסות על רכוש, עבודות ציבוריות, בינוי ושיכון.\
  בהתאם מטפלת הועדה בצרכנות, הגנת הצרכן, אנרגיה, תקשורת, בנקאות, תיירות, מנהל מקרקעי ישראל, מים, ביוב ועוד.",
    "name": "\u05d5\u05e2\u05d3\u05ea \u05d4\u05db\u05dc\u05db\u05dc\u05d4",
    "resource_uri": "/api/v2/committee/2/"
  },
  {
    id: 9,
    "absolute_url": "/committee/9/",
    "description": "\u05ea\u05e7\u05e6\u05d9\u05d1 \u05d4\u05de\u05d3\u05d9\u05e0\u05d4; \u05de\u05e1\u05d9\u05dd \u05dc\u05db\u05dc \u05e1\u05d5\u05d2\u05d9\u05d4\u05dd; \u05de\u05db\u05e1 \u05d5\u05d1\u05dc\u05d5; \u05de\u05dc\u05d5\u05d5\u05ea; \u05e2\u05e0\u05d9\u05d9\u05e0\u05d9 \u05de\u05d8\u05d1\u05e2 \u05d7\u05d5\u05e5; \u05d1\u05e0\u05e7\u05d0\u05d5\u05ea \u05d5\u05e9\u05d8\u05e8\u05d9 \u05db\u05e1\u05e3; \u05d4\u05db\u05e0\u05e1\u05d5\u05ea \u05d5\u05d4\u05d5\u05e6\u05d0\u05d5\u05ea \u05d4\u05de\u05d3\u05d9\u05e0\u05d4.\r\n",
    "name": "ועדת הכספים",
    "resource_uri": "/api/v2/committee/9/"
  },
  {
    id: 4,
    "absolute_url": "/committee/4/",
    "description": "\u05e9\u05dc\u05d8\u05d5\u05df \u05de\u05e7\u05d5\u05de\u05d9; \u05d1\u05e0\u05d9\u05d9\u05df \u05e2\u05e8\u05d9\u05dd; \u05db\u05e0\u05d9\u05e1\u05d4 \u05dc\u05d9\u05e9\u05e8\u05d0\u05dc \u05d5\u05de\u05e8\u05e9\u05dd \u05d4\u05d0\u05d5\u05db\u05dc\u05d5\u05e1\u05d9\u05df; \u05d0\u05d6\u05e8\u05d7\u05d5\u05ea; \u05e2\u05d9\u05ea\u05d5\u05e0\u05d5\u05ea \u05d5\u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df; \u05e2\u05d3\u05d5\u05ea; \u05d0\u05e8\u05d2\u05d5\u05df \u05d4\u05d3\u05ea\u05d5\u05ea \u05e9\u05dc \u05d9\u05d4\u05d5\u05d3\u05d9\u05dd \u05d5\u05e9\u05dc \u05dc\u05d0-\u05d9\u05d4\u05d5\u05d3\u05d9\u05dd; \u05de\u05e9\u05d8\u05e8\u05d4 \u05d5\u05d1\u05ea\u05d9-\u05d4\u05e1\u05d5\u05d4\u05e8; \u05d0\u05d9\u05db\u05d5\u05ea \u05d4\u05e1\u05d1\u05d9\u05d1\u05d4.\n",
    "name": "ועדת הפנים והגנת סביבה",
    "resource_uri": "/api/v2/committee/4/"
  },
  {
    id: 1,
    absolute_url: "/committee/1/",
    description: "תקנון הכנסת ועניינים הנובעים ממנו; חסינות חברי הכנסת ובקשות לנטילתה; סדרי הבית; המלצות על הרכב הוועדות הקבועות והוועדות לעניינים מסוימים, ויושבי-ראש שלהן; תיחום ותיאום הוועדות; העברת בקשות המוגשות לכנסת מן הציבור ליושב-ראש הכנסת או לוועדות המתאימות; דיון בתלונות על חברי הכנסת; תשלומים לחברי הכנסת; דיון בבקשות ובעניינים שאינם נוגעים לשום ועדה או שלא נכללו בתפקידי ועדה אחרת.",
    name: "ועדת הכנסת",
    resource_uri: "/api/v2/committee/1/"
  },
  {
    id: 15,
    "absolute_url": "/committee/15/",
    "description": "\u05d4\u05d2\u05e0\u05d4 \u05e2\u05dc \u05d4\u05d9\u05dc\u05d3\u05d9\u05dd \u05d5\u05e7\u05d9\u05d3\u05d5\u05dd \u05de\u05e2\u05de\u05d3 \u05d4\u05d9\u05dc\u05d3\u05d9\u05dd \u05d5\u05d1\u05e0\u05d9 \u05d4\u05e0\u05d5\u05e2\u05e8, \u05d1\u05de\u05d8\u05e8\u05d4 \u05dc\u05de\u05de\u05e9 \u05d0\u05ea \u05d6\u05db\u05d5\u05d9\u05d5\u05ea\u05d9\u05d4\u05dd \u05d1\u05e8\u05d5\u05d7 \u05d4\u05d0\u05de\u05e0\u05d4 \u05d4\u05d1\u05d9\u05e0\u05dc\u05d0\u05d5\u05de\u05d9\u05ea \u05dc\u05d6\u05db\u05d5\u05d9\u05d5\u05ea \u05d4\u05d9\u05dc\u05d3, \u05dc\u05e8\u05d1\u05d5\u05ea \u05de\u05d9\u05de\u05d5\u05e9 \u05d4\u05e2\u05e7\u05e8\u05d5\u05e0\u05d5\u05ea \u05e9\u05dc \u05d8\u05d5\u05d1\u05ea \u05d4\u05d9\u05dc\u05d3, \u05d0\u05d9-\u05d0\u05e4\u05dc\u05d9\u05d4, \u05d4\u05d6\u05db\u05d5\u05ea \u05dc\u05d4\u05ea\u05e4\u05ea\u05d7\u05d5\u05ea \u05d1\u05ea\u05e0\u05d0\u05d9\u05dd \u05e0\u05d0\u05d5\u05ea\u05d9\u05dd, \u05d5\u05d6\u05db\u05d5\u05ea \u05e9\u05dc \u05d9\u05dc\u05d3\u05d9\u05dd \u05d1\u05e0\u05d9 \u05e0\u05d5\u05e2\u05e8 \u05dc\u05d4\u05e9\u05de\u05d9\u05e2 \u05d0\u05ea \u05d3\u05e2\u05ea\u05dd \u05d5\u05dc\u05d4\u05e9\u05ea\u05ea\u05e3 \u05d1\u05e2\u05e0\u05d9\u05d9\u05e0\u05d9\u05dd \u05d4\u05e0\u05d5\u05d2\u05e2\u05d9\u05dd \u05d1\u05d4\u05dd.\n",
    "name": "הועדה לזכויות הילד",
    "resource_uri": "/api/v2/committee/15/"
  },
  {
    id: 8,
    "absolute_url": "/committee/8/",
    "description": "\u05de\u05d3\u05d9\u05e0\u05d9\u05d5\u05ea \u05de\u05d7\u05e7\u05e8 \u05d5\u05e4\u05d9\u05ea\u05d5\u05d7 \u05d0\u05d6\u05e8\u05d7\u05d9 \u05d1\u05d9\u05e9\u05e8\u05d0\u05dc, \u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05d5\u05ea \u05de\u05ea\u05e7\u05d3\u05de\u05d5\u05ea, \u05de\u05d7\u05e7\u05e8 \u05d5\u05e4\u05d9\u05ea\u05d5\u05d7 \u05e1\u05d1\u05d9\u05d1\u05ea\u05d9, \u05de\u05d7\u05e7\u05e8 \u05de\u05d3\u05e2\u05d9 \u05d1\u05d0\u05e7\u05d3\u05de\u05d9\u05d4 \u05d9\u05e9\u05e8\u05d0\u05dc\u05d9\u05ea \u05dc\u05de\u05d3\u05e2\u05d9\u05dd, \u05de\u05d7\u05e7\u05e8 \u05de\u05d3\u05e2\u05d9 \u05e9\u05dc\u05d0 \u05d1\u05de\u05d5\u05e1\u05d3\u05d5\u05ea \u05dc\u05d4\u05e9\u05db\u05dc\u05d4 \u05d2\u05d1\u05d5\u05d4\u05d4, \u05de\u05db\u05d5\u05e0\u05d9 \u05de\u05d7\u05e7\u05e8, \u05de\u05d3\u05e2\u05e0\u05d9\u05dd \u05e8\u05d0\u05e9\u05d9\u05d9\u05dd \u05e9\u05dc \u05db\u05dc\u05dc \u05de\u05e9\u05e8\u05d3\u05d9 \u05d4\u05de\u05de\u05e9\u05dc\u05d4, \u05de\u05d5\u05e2\u05e6\u05d4 \u05dc\u05d0\u05d5\u05de\u05d9\u05ea \u05dc\u05de\u05d7\u05e7\u05e8 \u05d5\u05e4\u05d9\u05ea\u05d5\u05d7, \u05e7\u05e8\u05e0\u05d5\u05ea \u05de\u05d7\u05e7\u05e8, \u05de\u05d9\u05d3\u05e2 \u05d5\u05de\u05d9\u05d7\u05e9\u05d5\u05d1.\n",
    "name": "ועדת מדע וטכנולוגיה",
    "resource_uri": "/api/v2/committee/8/"
  },
  {
    id: 5,
    "absolute_url": "/committee/5/",
    "description": "\u05d3\u05d9\u05d5\u05e0\u05d9 \u05d5\u05e2\u05d3\u05ea \u05d4\u05d7\u05d5\u05e7\u05d4 \u05d7\u05d5\u05e7 \u05d5\u05de\u05e9\u05e4\u05d8 \u05d1\u05d4\u05e6\u05e2\u05d5\u05ea \u05d7\u05e7\u05d9\u05e7\u05d4 \u05d5\u05d4\u05db\u05e0\u05ea\u05df \u05e9\u05dc \u05d4\u05e6\u05e2\u05d5\u05ea \u05d4\u05d7\u05d5\u05e7 \u05dc\u05e9\u05dc\u05d1\u05d9 \u05e7\u05e8\u05d9\u05d0\u05d4 \u05e8\u05d0\u05e9\u05d5\u05e0\u05d4, \u05e9\u05e0\u05d9\u05d4 \u05d5\u05e9\u05dc\u05d9\u05e9\u05d9\u05ea \u05d1\u05de\u05dc\u05d9\u05d0\u05ea \u05d4\u05db\u05e0\u05e1\u05ea\n",
    "name": "ועדת חוקה חוק ומשפט",
    "resource_uri": "/api/v2/committee/5/"
  },
  {
    id: 10,
    "absolute_url": "/committee/10/",
    "description": "\u05e2\u05d1\u05d5\u05d3\u05d4; \u05d1\u05d9\u05d8\u05d7\u05d5\u05df \u05e1\u05d5\u05e6\u05d9\u05d0\u05dc\u05d9; \u05dc\u05e8\u05d1\u05d5\u05ea \u05de\u05e2\u05e8\u05db\u05ea \u05d4\u05d1\u05d8\u05d7\u05ea \u05d4\u05db\u05e0\u05e1\u05d4; \u05d4\u05de\u05d5\u05e1\u05d3 \u05dc\u05d1\u05d9\u05d8\u05d5\u05d7 \u05dc\u05d0\u05d5\u05de\u05d9; \u05d1\u05e8\u05d9\u05d0\u05d5\u05ea; \u05e1\u05e2\u05d3; \u05e9\u05d9\u05e7\u05d5\u05dd; \u05e0\u05db\u05d9\u05dd \u05d5\u05e9\u05d9\u05e7\u05d5\u05de\u05dd; \u05dc\u05e8\u05d1\u05d5\u05ea \u05e0\u05db\u05d9 \u05e6\u05d4\u201d\u05dc \u05d5\u05de\u05e9\u05e4\u05d7\u05d5\u05ea \u05e0\u05e4\u05d2\u05e2\u05d9 \u05de\u05dc\u05d7\u05de\u05d4 \u05d5\u05db\u05df \u05e0\u05e4\u05d2\u05e2\u05d9\u05dd \u05d0\u05d7\u05e8\u05d9\u05dd; \u05e2\u05d1\u05e8\u05d9\u05d9\u05e0\u05d9\u05dd \u05e6\u05e2\u05d9\u05e8\u05d9\u05dd; \u05d2\u05de\u05dc\u05d0\u05d5\u05ea \u05d5\u05ea\u05d2\u05de\u05d5\u05dc\u05d9\u05dd; \u05d7\u05d5\u05e7\u05ea \u05d4\u05ea\u05e9\u05dc\u05d5\u05de\u05d9\u05dd \u05dc\u05d7\u05d9\u05d9\u05dc\u05d9\u05dd \u05d5\u05dc\u05de\u05e9\u05e4\u05d7\u05d5\u05ea\u05d9\u05d4\u05dd.\n",
    "name": "ועדת עבודה רווחה ובריאות",
    "resource_uri": "/api/v2/committee/10/"
  },
  {
    id: 11,
    "absolute_url": "/committee/11/",
    "description": "\u05e7\u05d9\u05d3\u05d5\u05dd \u05de\u05e2\u05de\u05d3 \u05d4\u05d0\u05e9\u05d4 \u05dc\u05e7\u05e8\u05d0\u05ea \u05e9\u05d5\u05d5\u05d9\u05d5\u05df \u05d1\u05d9\u05d9\u05e6\u05d5\u05d2; \u05d1\u05d7\u05d9\u05e0\u05d5\u05da \u05d5\u05d1\u05de\u05e2\u05de\u05d3 \u05d4\u05d0\u05d9\u05e9\u05d9, \u05d5\u05db\u05df \u05dc\u05de\u05e0\u05d9\u05e2\u05ea \u05d0\u05e4\u05dc\u05d9\u05d4 \u05d1\u05e9\u05dc \u05de\u05d9\u05df \u05d0\u05d5 \u05e0\u05d8\u05d9\u05d9\u05d4 \u05de\u05d9\u05e0\u05d9\u05ea \u05d1\u05db\u05dc \u05d4\u05ea\u05d7\u05d5\u05de\u05d9\u05dd; \u05dc\u05d4\u05e7\u05d8\u05e0\u05ea \u05e4\u05e2\u05e8\u05d9\u05dd \u05d1\u05db\u05dc\u05db\u05dc\u05d4 \u05d5\u05d1\u05e9\u05d5\u05e7 \u05d4\u05e2\u05d1\u05d5\u05d3\u05d4 \u05d5\u05dc\u05de\u05d0\u05d1\u05e7 \u05d1\u05d0\u05dc\u05d9\u05de\u05d5\u05ea \u05db\u05dc\u05e4\u05d9 \u05e0\u05e9\u05d9\u05dd.\r\n",
    "name": "ועדת קידום מעמד האישה ושוויון מגדרי",
    "resource_uri": "/api/v2/committee/11/"
  },
  {
    id: 6,
    "absolute_url": "/committee/6/",
    "description": "\u05d7\u05d9\u05e0\u05d5\u05da; \u05ea\u05e8\u05d1\u05d5\u05ea; \u05de\u05d3\u05e2; \u05d0\u05de\u05e0\u05d5\u05ea; \u05e9\u05d9\u05d3\u05d5\u05e8; \u05e7\u05d5\u05dc\u05e0\u05d5\u05e2; \u05ea\u05e8\u05d1\u05d5\u05ea \u05d4\u05d2\u05d5\u05e3.\n",
    "name": "ועדת חינוך, תרבות וספורט",
    "resource_uri": "/api/v2/committee/6/"
  },
  {
    id: 3,
    "absolute_url": "/committee/3/",
    "description": "\u05e2\u05dc\u05d9\u05d9\u05d4; \u05e7\u05dc\u05d9\u05d8\u05d4; \u05d4\u05d8\u05d9\u05e4\u05d5\u05dc \u05d1\u05d9\u05d5\u05e8\u05d3\u05d9\u05dd; \u05d7\u05d9\u05e0\u05d5\u05da \u05d9\u05d4\u05d5\u05d3\u05d9 \u05d5\u05e6\u05d9\u05d5\u05e0\u05d9 \u05d1\u05d2\u05d5\u05dc\u05d4; \u05de\u05db\u05dc\u05d5\u05dc \u05d4\u05e0\u05d5\u05e9\u05d0\u05d9\u05dd \u05d4\u05e7\u05e9\u05d5\u05e8\u05d9\u05dd \u05d1\u05e2\u05e0\u05d9\u05d9\u05e0\u05d9\u05dd \u05d0\u05dc\u05d4 \u05d5\u05d4\u05e0\u05de\u05e6\u05d0\u05d9\u05dd \u05d1\u05ea\u05d7\u05d5\u05dd \u05d8\u05d9\u05e4\u05d5\u05dc\u05d5 \u05e9\u05dc \u05d4\u05de\u05d5\u05e1\u05d3 \u05dc\u05ea\u05d9\u05d0\u05d5\u05dd \u05d1\u05d9\u05df \u05de\u05de\u05e9\u05dc\u05ea \u05d9\u05e9\u05e8\u05d0\u05dc \u05dc\u05d1\u05d9\u05df \u05d4\u05d4\u05e1\u05ea\u05d3\u05e8\u05d5\u05ea \u05d4\u05e6\u05d9\u05d5\u05e0\u05d9\u05ea \u05d4\u05e2\u05d5\u05dc\u05de\u05d9\u05ea \u05d5\u05d1\u05d9\u05df \u05de\u05de\u05e9\u05dc\u05ea \u05d9\u05e9\u05e8\u05d0\u05dc \u05dc\u05d1\u05d9\u05df \u05d4\u05e1\u05d5\u05db\u05e0\u05d5\u05ea \u05d4\u05d9\u05d4\u05d5\u05d3\u05d9\u05ea.\n",
    "name": "ועדת עלייה קליטה ותפוצות",
    "resource_uri": "/api/v2/committee/3/"
  },
  {
    id: 99,
    absolute_url: "/committee/99/",
    description: "פיקוח ובקרה על מדיניות החוץ של המדינה, כוחותיה המזוינים וביטחונה.",
    name: "ועדת החוץ והביטחון"
  }
];

})();
