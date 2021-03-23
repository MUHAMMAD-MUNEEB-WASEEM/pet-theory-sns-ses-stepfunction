"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseTemplate = exports.requestTemplate = exports.EVENT_SOURCE = void 0;
exports.EVENT_SOURCE = "PetEvents";
exports.requestTemplate = (details, detailType) => {
    return `{
          "version": "2018-05-29",
          "method": "POST", 
          "resourcePath": "/",
          "params": {
            "headers": {
              "content-type": "application/x-amz-json-1.1",
              "x-amz-target":"AWSEvents.PutEvents"
            },
            "body": {
              "Entries":[
                {
                  "DetailType":"${detailType}",
                  "Source":"${exports.EVENT_SOURCE}",
                  "EventBusName": "default",
                  "Detail": "{${details}}"
                }
              ]
            }
          }
        }`;
};
exports.responseTemplate = () => {
    return `
          #if($ctx.error)
              $util.error($ctx.error.message, $ctx.error.type)
          #end
          #if($ctx.result.statusCode == 200)
          {
              "result": "$util.parseJson($ctx.result.body)"
          }
          #else
              $utils.appendError($ctx.result.body, $ctx.result.statusCode)
          #end
      `;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzcG9uc2UtcmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlc3BvbnNlLXJlcXVlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQWEsUUFBQSxZQUFZLEdBQUcsV0FBVyxDQUFDO0FBRTNCLFFBQUEsZUFBZSxHQUFHLENBQUMsT0FBZSxFQUFFLFVBQWtCLEVBQUUsRUFBRTtJQUNuRSxPQUFPOzs7Ozs7Ozs7Ozs7a0NBWXVCLFVBQVU7OEJBQ2Qsb0JBQVk7O2dDQUVWLE9BQU87Ozs7O1VBSzdCLENBQUM7QUFDWCxDQUFDLENBQUM7QUFFVyxRQUFBLGdCQUFnQixHQUFHLEdBQUcsRUFBRTtJQUNqQyxPQUFPOzs7Ozs7Ozs7OztPQVdKLENBQUM7QUFDUixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3QgRVZFTlRfU09VUkNFID0gXCJQZXRFdmVudHNcIjtcclxuXHJcbmV4cG9ydCBjb25zdCByZXF1ZXN0VGVtcGxhdGUgPSAoZGV0YWlsczogc3RyaW5nLCBkZXRhaWxUeXBlOiBzdHJpbmcpID0+IHtcclxuICAgIHJldHVybiBge1xyXG4gICAgICAgICAgXCJ2ZXJzaW9uXCI6IFwiMjAxOC0wNS0yOVwiLFxyXG4gICAgICAgICAgXCJtZXRob2RcIjogXCJQT1NUXCIsIFxyXG4gICAgICAgICAgXCJyZXNvdXJjZVBhdGhcIjogXCIvXCIsXHJcbiAgICAgICAgICBcInBhcmFtc1wiOiB7XHJcbiAgICAgICAgICAgIFwiaGVhZGVyc1wiOiB7XHJcbiAgICAgICAgICAgICAgXCJjb250ZW50LXR5cGVcIjogXCJhcHBsaWNhdGlvbi94LWFtei1qc29uLTEuMVwiLFxyXG4gICAgICAgICAgICAgIFwieC1hbXotdGFyZ2V0XCI6XCJBV1NFdmVudHMuUHV0RXZlbnRzXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJib2R5XCI6IHtcclxuICAgICAgICAgICAgICBcIkVudHJpZXNcIjpbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwiRGV0YWlsVHlwZVwiOlwiJHtkZXRhaWxUeXBlfVwiLFxyXG4gICAgICAgICAgICAgICAgICBcIlNvdXJjZVwiOlwiJHtFVkVOVF9TT1VSQ0V9XCIsXHJcbiAgICAgICAgICAgICAgICAgIFwiRXZlbnRCdXNOYW1lXCI6IFwiZGVmYXVsdFwiLFxyXG4gICAgICAgICAgICAgICAgICBcIkRldGFpbFwiOiBcInske2RldGFpbHN9fVwiXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWA7XHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgcmVzcG9uc2VUZW1wbGF0ZSA9ICgpID0+IHtcclxuICAgIHJldHVybiBgXHJcbiAgICAgICAgICAjaWYoJGN0eC5lcnJvcilcclxuICAgICAgICAgICAgICAkdXRpbC5lcnJvcigkY3R4LmVycm9yLm1lc3NhZ2UsICRjdHguZXJyb3IudHlwZSlcclxuICAgICAgICAgICNlbmRcclxuICAgICAgICAgICNpZigkY3R4LnJlc3VsdC5zdGF0dXNDb2RlID09IDIwMClcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcInJlc3VsdFwiOiBcIiR1dGlsLnBhcnNlSnNvbigkY3R4LnJlc3VsdC5ib2R5KVwiXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAjZWxzZVxyXG4gICAgICAgICAgICAgICR1dGlscy5hcHBlbmRFcnJvcigkY3R4LnJlc3VsdC5ib2R5LCAkY3R4LnJlc3VsdC5zdGF0dXNDb2RlKVxyXG4gICAgICAgICAgI2VuZFxyXG4gICAgICBgO1xyXG59OyJdfQ==