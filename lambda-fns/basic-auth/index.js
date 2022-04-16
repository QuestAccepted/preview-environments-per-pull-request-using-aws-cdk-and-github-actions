// Load the AWS SDK
var AWS = require('aws-sdk');
var region = "us-east-1",
    secretKey = "github/preview";

// Create a Secrets Manager client
var sm = new AWS.SecretsManager({
    region: region
});

const getSecrets = async (secretId) => {
    return await new Promise((resolve, reject) => {
        sm.getSecretValue({ SecretId: secretId }, (err, result) => {
            if (err) reject(err)
            else resolve(JSON.parse(result.SecretString));
        })
    })

}

exports.handler = async (event, context, callback) => {

    const request = event.Records[0].cf.request

    const headers = request.headers

    const user = 'my-username'
    console.log('User:', user);
    const { password } = await getSecrets(secretKey);


    const authString = 'Basic ' + Buffer.from(user + ':' + password).toString('base64')



    if (typeof headers.authorization === 'undefined' || headers.authorization[0].value !== authString) {

        const response = {
            status: '401',
            statusDescription: 'Unauthorized',
            body: 'Unauthorized',
            headers: {
                'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic' }]
            }
        }

        callback(null, response)
    }

    callback(null, request)
}