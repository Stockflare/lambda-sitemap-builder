// dependencies
var aws = require('aws-sdk');
var _ = require('underscore');
var path = require('path');
var when = require('when');
var moment = require('moment');
var rest = require('restler');

exports.handler = function(event, context) {

  console.log('event');
  console.log(event);

  var all_done = when.promise(function(all_done_resolve, all_done_reject, all_done_notify) {
    
  }).done(function(){
    console.log("Successfully created sitemap");
    context.succeed("Successfully created sitemap");
  }, function(reason){
    console.log("Failed to create sitemap: " + reason);
    context.fail("Failed to create sitemap: " + reason);
  });



  rest.get(event.fx_url).on('success', function(fx_result, response) {
    console.log(fx_result);

    // Do a post to api-currency fo every currency
    var updated_at = Math.floor(new Date().getTime() / 1000);
    promises = _.map(_.keys(fx_result), function(key, index, currencies){
      return when.promise(function(resolve, reject, notify){
        rest.post(event.currency_url, {
          data: {
            from: key,
            to: 'usd',
            rate: 1.0 / fx_result[key],
            updated_at: updated_at
          }
        }).on('success', function(currency_result, response){
          resolve(fx_result[key]);
        }).on('fail', function(data, response){
          console.log('Error:', data);
          reject(data);
        });
      });
    });

    when.all(all_done).done(function(){
      console.log("Successfully created sitemap");
      context.succeed("Successfully created sitemap");
    }, function(reason){
      console.log("Failed to create sitemap: " + reason);
      context.fail("Failed to create sitemap: " + reason);
    });

  }).on('fail', function(data, response){
    console.log('Error:', data);
    context.fail("Failed to process fx call");
  });

};
