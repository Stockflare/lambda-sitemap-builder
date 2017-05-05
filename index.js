// dependencies
var AWS = require('aws-sdk');
var _ = require('underscore');
var _l = require('lodash');
var path = require('path');
var when = require('when');
var moment = require('moment');
var rest = require('restler');
var sm = require('sitemap');
var fs = require('fs');
var zlib = require('zlib');
var str = require('string-to-stream');
var builder = require('xmlbuilder');

exports.handler = function(event, context) {

  console.log('Record:', JSON.stringify(event, null, 2));

  var all_done = when.promise(function(all_done_resolve, all_done_reject, all_done_notify) {

    var total_pages = 9999;
    var rics = [];
    var max_pages = 99999;

    if (!_.isUndefined(event.max_pages)) {
      max_pages = event.max_pages;
    }

    when.iterate(function(next_page){
      return next_page + 10;
    },
    function(page){
      return page >= total_pages || page > max_pages;
    }, function(page) {
      return when.promise(function(resolve, reject, notify){

        var get_rics = function(page) {
          return when.promise(function(resolve, reject, notify){
            var search_body = _.extend(event.search_body, {page: page, select: "ric", per_page: 30});
            rest.putJson(event.search_url, search_body)
            .on('success', function(data, response){
              if (data.length > 0) {
                _.each(data, function(stock){
                  rics.push(stock.ric);
                });
              }
              // console.log('Got page: ' + page);
              // console.log('Total Rics: ' + rics.length);
              total_pages = parseInt(response.headers['x-api-pages']);
              resolve();
            }).on('fail', function(data, response){
              console.log('Error:', data);
              console.log(search_body);
              reject(data);
            });
          });
        };

        // Kick off 10 page fetches
        var promises = _.map(_.range(page, page + 10), function(page){
          return get_rics(page);
        });

        // When all fetches are done then let the loop continue
        when.all(promises).done(function(){
          resolve();
        }, function(reason){
          reject(reason);
        });

      });
    },
    0)
    .done(function(){

      var upload = function(content, filename) {
        return when.promise(function(resolve, reject, notify){
          // Upload sitemap to S3
          s3Stream = require('s3-upload-stream')(new AWS.S3());
          // Create the streams
          var read = str(content);
          var compress = zlib.createGzip();
          var upload = s3Stream.upload({
            "Bucket": event.sitemap_bucket,
            "Key": filename
          });

          // Optional configuration
          upload.maxPartSize(20971520); // 20 MB
          upload.concurrentParts(5);

          // Handle errors.
          upload.on('error', function (error) {
            console.log(error);
            reject(error);
          });

          upload.on('part', function (details) {
            // console.log(details);
          });

          upload.on('uploaded', function (details) {
            console.log(details);
            resolve();
          });

          // Pipe the incoming stream through compression, and up to S3.
          read.pipe(compress).pipe(upload);
        });
      };

      var chunks = _l.chunk(rics, 10000);

      when.iterate(function(index){
        return index + 1;
      },
      function(index){
        return index > (chunks.length - 1);
      },
      function(index){
        return when.promise(function(resolve, reject, notify){
          var chunk = chunks[index];
          var urls = [
            { url: '/' , changefreq: 'weekly', priority: 0.5 }
          ];

          var date = new Date();

          _.each(chunk, function(ric){
            urls.push({
              url: event.stocks_path + ric , changefreq: 'daily', priority: 0.5, lastmod: date
            });
          });

          // Create the sitemap in memory
          var sitemap = sm.createSitemap({
              hostname: event.site_url,
              cacheTime: 600000,  //600 sec (10 min) cache purge period
              urls: urls
          });

          // Write the sitempa file
          when(upload(sitemap.toString(), 'sitemap' + (index + 1) + '.xml.gz')).done(function(){
            resolve();
          }, function(reason){
            reject(reason);
          });
        });
      },
      0).done(function(){
        // Now create the Master sitemap index
        var root = builder.create('sitemapindex', {encoding: 'UTF-8'}).att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');

        // add in each sitemap
        _.each(chunks, function(chunk, index){
          var sitemap = root.ele('sitemap');
          sitemap.ele('loc', event.site_url + '/sitemap' + (index + 1) + '.xml.gz');
          sitemap.ele('lastmod', new Date().toISOString());
        });

        var xmlString = root.end({
          pretty: true,
          indent: '  ',
          newline: '\n',
          allowEmpty: false
        });

        // Uplad Master index sitemap
        when(upload(xmlString, 'sitemap.xml.gz')).done(function(){
          // now ping Google to tell them the sitemap is updated;
          when.promise(function(resolve, reject, notify){
            rest.get('http://google.com/ping?sitemap=' + event.site_url + '/sitemap.xml.gz')
            .on('success', function(data, response){
              console.log('Google Ping: ' + data);
              resolve();
            }).on('fail', function(data, response){
              console.log('Google Ping Error:', data);
              resolve();
            });
          }).done(function(){
            all_done_resolve();
          });

        }, function(reason){
          all_done_reject(reason);
        });

      }, function(reason){
        all_done_reject(reason);
      });

    }, function(reason){
      all_done_reject(reason);
    });

  }).done(function(){
    console.log("Successfully created sitemap");
    context.succeed("Successfully created sitemap");
  }, function(reason){
    console.log("Failed to create sitemap: " + reason);
    context.fail("Failed to create sitemap: " + reason);
  });

};
