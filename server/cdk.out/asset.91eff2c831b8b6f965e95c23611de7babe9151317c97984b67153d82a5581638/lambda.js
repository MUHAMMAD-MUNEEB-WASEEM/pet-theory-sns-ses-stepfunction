"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = require("aws-sdk");
const ses = new aws_sdk_1.SES();
async function handler(event, context) {
    console.log("REQUEST ==>>", event.body);
    const { to, from, subject, text } = JSON.parse(event.body || "{}");
    if (!to || !from || !subject || !text) {
        return Responses._400({
            message: 'to, from, subject and text are all required in the body',
        });
    }
    const params = {
        Destination: {
            ToAddresses: [to],
        },
        Message: {
            Body: {
                Text: { Data: text },
            },
            Subject: { Data: subject },
        },
        Source: from,
    };
    try {
        await ses.sendEmail(params).promise();
        return Responses._200({ message: 'The email has been sent' });
    }
    catch (error) {
        console.log('error sending email ', error);
        return Responses._400({ message: 'The email failed to send' });
    }
}
exports.handler = handler;
const Responses = {
    _200(data) {
        return {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Methods': '*',
                'Access-Control-Allow-Origin': '*',
            },
            statusCode: 200,
            body: JSON.stringify(data),
        };
    },
    _400(data) {
        return {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Methods': '*',
                'Access-Control-Allow-Origin': '*',
            },
            statusCode: 400,
            body: JSON.stringify(data),
        };
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHFDQUE4QjtBQUU5QixNQUFNLEdBQUcsR0FBRyxJQUFJLGFBQUcsRUFBRSxDQUFDO0FBU2YsS0FBSyxVQUFVLE9BQU8sQ0FBQyxLQUEyQixFQUFFLE9BQWdCO0lBQ3ZFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV4QyxNQUFNLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFFLElBQUksQ0FBZSxDQUFDO0lBRS9FLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDbkMsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBQ2xCLE9BQU8sRUFBRSx5REFBeUQ7U0FDckUsQ0FBQyxDQUFDO0tBQ047SUFFRCxNQUFNLE1BQU0sR0FBRztRQUNYLFdBQVcsRUFBRTtZQUNULFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQztTQUNwQjtRQUNELE9BQU8sRUFBRTtZQUNMLElBQUksRUFBRTtnQkFDRixJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO2FBQ3ZCO1lBQ0QsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRTtTQUM3QjtRQUNELE1BQU0sRUFBRSxJQUFJO0tBQ2YsQ0FBQztJQUVGLElBQUk7UUFDQSxNQUFNLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdEMsT0FBTyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLENBQUMsQ0FBQztLQUNqRTtJQUFDLE9BQU8sS0FBSyxFQUFFO1FBQ1osT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQyxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO0tBQ2xFO0FBR0wsQ0FBQztBQWpDRCwwQkFpQ0M7QUFJRCxNQUFNLFNBQVMsR0FBRztJQUNkLElBQUksQ0FBQyxJQUFZO1FBQ2IsT0FBTztZQUNILE9BQU8sRUFBRTtnQkFDTCxjQUFjLEVBQUUsa0JBQWtCO2dCQUNsQyw4QkFBOEIsRUFBRSxHQUFHO2dCQUNuQyw2QkFBNkIsRUFBRSxHQUFHO2FBQ3JDO1lBQ0QsVUFBVSxFQUFFLEdBQUc7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7U0FDN0IsQ0FBQztJQUNOLENBQUM7SUFFRCxJQUFJLENBQUMsSUFBWTtRQUNiLE9BQU87WUFDSCxPQUFPLEVBQUU7Z0JBQ0wsY0FBYyxFQUFFLGtCQUFrQjtnQkFDbEMsOEJBQThCLEVBQUUsR0FBRztnQkFDbkMsNkJBQTZCLEVBQUUsR0FBRzthQUNyQztZQUNELFVBQVUsRUFBRSxHQUFHO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1NBQzdCLENBQUM7SUFDTixDQUFDO0NBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQsIENvbnRleHQgfSBmcm9tICdhd3MtbGFtYmRhJztcclxuaW1wb3J0IHsgU0VTIH0gZnJvbSBcImF3cy1zZGtcIjtcclxuXHJcbmNvbnN0IHNlcyA9IG5ldyBTRVMoKTtcclxuXHJcbmludGVyZmFjZSBFbWFpbFBhcmFtIHtcclxuICAgIHRvPzogc3RyaW5nO1xyXG4gICAgZnJvbT86IHN0cmluZztcclxuICAgIHN1YmplY3Q/OiBzdHJpbmc7XHJcbiAgICB0ZXh0Pzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnQsIGNvbnRleHQ6IENvbnRleHQpOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4ge1xyXG4gICAgY29uc29sZS5sb2coXCJSRVFVRVNUID09Pj5cIiwgZXZlbnQuYm9keSk7XHJcblxyXG4gICAgY29uc3QgeyB0bywgZnJvbSwgc3ViamVjdCwgdGV4dCB9ID0gSlNPTi5wYXJzZShldmVudC5ib2R5fHxcInt9XCIpIGFzIEVtYWlsUGFyYW07XHJcblxyXG4gICAgaWYgKCF0byB8fCAhZnJvbSB8fCAhc3ViamVjdCB8fCAhdGV4dCkge1xyXG4gICAgICAgIHJldHVybiBSZXNwb25zZXMuXzQwMCh7XHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICd0bywgZnJvbSwgc3ViamVjdCBhbmQgdGV4dCBhcmUgYWxsIHJlcXVpcmVkIGluIHRoZSBib2R5JyxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwYXJhbXMgPSB7XHJcbiAgICAgICAgRGVzdGluYXRpb246IHtcclxuICAgICAgICAgICAgVG9BZGRyZXNzZXM6IFt0b10sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBNZXNzYWdlOiB7XHJcbiAgICAgICAgICAgIEJvZHk6IHtcclxuICAgICAgICAgICAgICAgIFRleHQ6IHsgRGF0YTogdGV4dCB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBTdWJqZWN0OiB7IERhdGE6IHN1YmplY3QgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIFNvdXJjZTogZnJvbSxcclxuICAgIH07XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCBzZXMuc2VuZEVtYWlsKHBhcmFtcykucHJvbWlzZSgpO1xyXG4gICAgICAgIHJldHVybiBSZXNwb25zZXMuXzIwMCh7IG1lc3NhZ2U6ICdUaGUgZW1haWwgaGFzIGJlZW4gc2VudCcgfSk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdlcnJvciBzZW5kaW5nIGVtYWlsICcsIGVycm9yKTtcclxuICAgICAgICByZXR1cm4gUmVzcG9uc2VzLl80MDAoeyBtZXNzYWdlOiAnVGhlIGVtYWlsIGZhaWxlZCB0byBzZW5kJyB9KTtcclxuICAgIH1cclxuXHJcblxyXG59XHJcblxyXG5cclxuXHJcbmNvbnN0IFJlc3BvbnNlcyA9IHtcclxuICAgIF8yMDAoZGF0YTogT2JqZWN0KSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJyonLFxyXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxyXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShkYXRhKSxcclxuICAgICAgICB9O1xyXG4gICAgfSxcclxuXHJcbiAgICBfNDAwKGRhdGE6IE9iamVjdCkge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICcqJyxcclxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcclxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoZGF0YSksXHJcbiAgICAgICAgfTtcclxuICAgIH0sXHJcbn07Il19