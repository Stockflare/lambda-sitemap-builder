# Lambda Sitemap Builder

A lambda function that will be triggered from a scheduled CloudWatch event that reads the stock index from Elasticsearch, created a `sitemap.xml` and uploads it to the S3 bucket for the site

The CloudWatch Event must be configured to send the following JSON payload

```
  'search_url': "https://api.stockflare.com/search/filter",
  'search_method': "PUT",
  'search_body': {
    "conditions": { "sic": ">0" }
  }
  "sitemap_bucket": "alpha.stockflare.com",
  "sitemap": "sitemap.xml"


```
