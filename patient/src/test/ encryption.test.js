const assert = require('assert');
const h = require('../helpers.js');


describe('Basic Encryption test', () => {
    it('Full JSON encrypt/decrypt test', () => {
        var json = {'value':15};
        var encrypted_json = h.encryptBuffer(JSON.stringify(json),'testKey');
        var decrypted_json = JSON.parse(h.decrypt(encrypted_json,'testKey'));
        assert.equal(json.value, decrypted_json.value);
    });

    
});