# Lambda Sitemap Builder

A lambda function that will be triggered from a scheduled CloudWatch event that reads the stock index from Elasticsearch, created a `sitemap.xml` and uploads it to the S3 bucket for the site

The CloudWatch Event must be configured to send the following JSON payload

```
{
  "search_url": "https://api.stockflare.com/search/filter",
  "site_url": "https://stockflare.com",
  "search_body": {
    "conditions": { "sic": ">0" },
    "page": "1"
  },
  "sitemap_bucket": "alpha.stockflare.com",
  "max_pages": 30 <Used to limit the dataset in testing>
}
```

# What it does

Firstly the function will use `when.iterate` to call `api-search` executing the filter query provided in the event.  The `iterate` will continue to fetch pages from `api-search` until all pages have been fetched.  The promise loop execute 10 asynchronous fetches to speed up processing and ensure that all pages are fetched within the lambda 5 minute timeout.  This process builds an array of `rics`.

Next its again uses `when.iterate` to loop through the rics in chunks for 2000 elements and for each chunk will create a XML sitemap and upload it to S3.

Next it will create a `sitmap.xml.gz` index file referencing each of the chunks and upload that to S3.

And finally it pings Google telling them that the sitemap has been updated.
