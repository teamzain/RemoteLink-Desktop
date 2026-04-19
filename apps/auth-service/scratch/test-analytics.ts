import axios from 'axios';

async function testAnalytics() {
  try {
    const res = await axios.get('http://159.65.84.190/api/analytics/summary', {
      headers: {
        Authorization: 'Bearer YOUR_TOKEN' // I don't have a token
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('Status:', err.response?.status);
    console.error('Data:', err.response?.data);
  }
}
// Skip running since I don't have a token.
