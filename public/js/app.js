var myApp = angular.module("myApp", []);
myApp.config(["$routeProvider","$locationProvider", function ($routeProvider, $locationProvider) {
  $routeProvider.
    when("/", {
      templateUrl: "/partials/index",
      controller: GraphCtrl
    }).
    when("/upload", {
      templateUrl: "partials/upload"
    })
    .when("/help", {
      templateUrl: "partials/help"
    }).
    otherwise({
      redirectTo: "/"
    });
    $locationProvider.html5Mode(true);
}]);