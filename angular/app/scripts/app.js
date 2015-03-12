'use strict';

angular
  .module('app', [
    'ngAnimate',
    'ngAria',
    'ngCookies',
    'ngMessages',
    'ngResource',
    'ui.router',
    'ngSanitize',
    'ngTouch',
    'angular-jwt',
    'app.settings',
    'angucomplete-alt',
    'ngFacebook',
    'timer',
    'infinite-scroll',
    'angularSpinner',
    'ui.bootstrap'
  ])

  .config(function ($stateProvider, $resourceProvider, $urlRouterProvider,
                    $facebookProvider) {
    $resourceProvider.defaults.stripTrailingSlashes = false;
    $facebookProvider.setAppId(window.OPEN_SUBS_FB_APP_ID);
    $facebookProvider.setPermissions("public_profile,email");
    $facebookProvider.setVersion("v2.2");
    // routing
    $urlRouterProvider.otherwise("splash");
    $stateProvider
     .state('splash', {
       url: '/splash',
       templateUrl: 'views/splash.html'
      })
      .state('about', {
        templateUrl: 'views/about.html',
      })
      .state('dive', {
        url: '/dive',
        templateUrl: 'views/dive.html',
        controller: 'DiveController'
      })
      .state('key', {
        url: '/key/:team?',
        templateUrl: 'views/key.html',
        controller: 'KeyController'
      })
      .state('home', {
        url: '/home',
        templateUrl: 'views/home.html',
        controller: 'HomeController'
      })
      .state('fin', {
        url: '/game',
        templateUrl: 'views/game_last.html',
        controller: 'GameLastController',
        reloadOnSearch: false
      })
      .state('game', {
        url: '/game/:level',
        templateUrl: 'views/committee.html',
        controller: 'CommitteeController',
        reloadOnSearch: false
      })
      .state('committee', {
        url: '/committee/:id/:stage?',
        templateUrl: 'views/committee.html',
        controller: 'CommitteeController',
        reloadOnSearch: false
      })
      // TODO: refactor to /person/:id
      .state('candidate', {
        url: '/candidate/:id',
        templateUrl: 'views/candidate-feed.html',
        controller: 'CandidateController'
      })
      .state('error', {
        url: '/error/:type/:next',
        templateUrl: 'views/error.html'
      })
      .state('welcome', {
        url: '/welcome',
        templateUrl: 'views/welcome.html'
      })
    ;
  })
  .factory('DATA', function() {
    return {
      'topOrgsStartWith': [
        'ליכוד',
        'מחנה הציוני',
        'בית היהודי',
        'רשימה המשותפת',
        'כולנו בראשות משה כחלון',
        'ישראל ביתנו',
        'יש עתיד',
        'שס',
        'יהדות התורה',
        'שמאל של ישראל' // this is meretz
      ]
    }
  })

  .factory('USER', function($facebook, $q, SETTINGS, $location) {
    return {
      ERROR_LOGIN: 0,
      ERROR_FBAPI: 1,
      login: function() {
        return $q(function(resolve, reject) {
          if (SETTINGS.noFacebook) {
            resolve();
          } else {
            $facebook.getLoginStatus().then(function(res) {
              if (res.status == 'connected') {
                if (!res || !res.authResponse) {
                  reject();
                } else {
                  resolve(res);
                }
              } else {
                reject();
              }
            });
          }
        });
      },
      register: function() {
        return $q(function(resolve, reject) {
          $facebook.login().then(function(res) {
            if (res.status == 'connected') {
              if (!res || !res.authResponse) {
                reject();
              } else {
                resolve(res);
              }
            } else {
              reject();
            }
          });
        });
      },
      fbapi: function(path, method, params) {
        var self = this;
        return $q(function(resolve, reject) {
          self.login().then(function(res) {
            $facebook.api(path, method, params).then(function(response) {
              resolve(response);
            }, function(error) {
              console.log('FBapi error: ' + error.message + '\n  url:' + path);
              reject(error, self.ERROR_FBAPI);
            });
          }, function(error) {
            console.log('login error: ' + error.message);
            reject(error, self.ERROR_LOGIN);
          });
        });
      }
    };
  })

  .factory('modal', function($modal) {
    return {
      show: function(template) {
        $modal.open({ templateUrl: template });
      }
    }
  })

  .run( function( SETTINGS, $rootScope ) {
    // expose the configuration on window - this is used for testing
    window.SETTINGS = SETTINGS;
    (function(d, s, id){
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) {return;}
      js = d.createElement(s); js.id = id;
      js.src = "//connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  })

  .controller('AppController', function($scope, $rootScope, $location, $window) {
    // if the user is not logged in to facebook he will be redirected to login screen
    // in this cases the user looses his place in the game (e.g. if he was watching a certain committee, he will need to find it again)
    // this $routeChangeStart handler "remembers" the last path and redirects to it from root path.
    $rootScope.$on("$routeChangeStart", function () {
      if ($location.path().length < 3) {
        var lastpath = $window.sessionStorage.getItem('lastpath');
        if (lastpath) {
          $location.path(lastpath);
        }
      } else {
        $window.sessionStorage.setItem('lastpath', $location.path());
      }
    });
  })

  .directive('ngReallyClick', [function() {
    /**
     * A generic confirmation for risky actions.
     * Usage: Add attributes: ng-really-message="Are you sure"? ng-really-click="takeAction()" function
     */
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.bind('click', function() {
                var message = attrs.ngReallyMessage;
                if (message && confirm(message)) {
                    scope.$apply(attrs.ngReallyClick);
                }
            });
        }
    }
  }])


;
