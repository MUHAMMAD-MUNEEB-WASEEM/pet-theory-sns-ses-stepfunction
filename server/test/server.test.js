"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("@aws-cdk/assert");
const cdk = require("@aws-cdk/core");
const Server = require("../lib/server-stack");
test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Server.ServerStack(app, 'MyTestStack');
    // THEN
    assert_1.expect(stack).to(assert_1.matchTemplate({
        "Resources": {}
    }, assert_1.MatchStyle.EXACT));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzZXJ2ZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDRDQUFpRjtBQUNqRixxQ0FBcUM7QUFDckMsOENBQThDO0FBRTlDLElBQUksQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO0lBQ3JCLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLE9BQU87SUFDUCxNQUFNLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ3pELE9BQU87SUFDUCxlQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLHNCQUFhLENBQUM7UUFDaEMsV0FBVyxFQUFFLEVBQUU7S0FDaEIsRUFBRSxtQkFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDekIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBleHBlY3QgYXMgZXhwZWN0Q0RLLCBtYXRjaFRlbXBsYXRlLCBNYXRjaFN0eWxlIH0gZnJvbSAnQGF3cy1jZGsvYXNzZXJ0JztcclxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ0Bhd3MtY2RrL2NvcmUnO1xyXG5pbXBvcnQgKiBhcyBTZXJ2ZXIgZnJvbSAnLi4vbGliL3NlcnZlci1zdGFjayc7XHJcblxyXG50ZXN0KCdFbXB0eSBTdGFjaycsICgpID0+IHtcclxuICAgIGNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XHJcbiAgICAvLyBXSEVOXHJcbiAgICBjb25zdCBzdGFjayA9IG5ldyBTZXJ2ZXIuU2VydmVyU3RhY2soYXBwLCAnTXlUZXN0U3RhY2snKTtcclxuICAgIC8vIFRIRU5cclxuICAgIGV4cGVjdENESyhzdGFjaykudG8obWF0Y2hUZW1wbGF0ZSh7XHJcbiAgICAgIFwiUmVzb3VyY2VzXCI6IHt9XHJcbiAgICB9LCBNYXRjaFN0eWxlLkVYQUNUKSlcclxufSk7XHJcbiJdfQ==