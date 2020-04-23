const assert = require('assert');
const h = require('../helpers.js');

describe('Helper functions:', () => {
    it('Encrypt/decrypt test', () => {
        var json = {'value':15};
        var encrypted_json = h.encryptBuffer(JSON.stringify(json),'testKey');
        var decrypted_json = JSON.parse(h.decrypt(encrypted_json,'testKey'));
        assert.equal(json.value, decrypted_json.value);
    });

    it('Random PIN length test', () => {
        var pin = h.generatePIN();
        assert(pin/1000000000000000<10);
    });

    it('isJSON test: Using JSON', () => {
        var json = JSON.stringify({'test':1});
        assert(h.isJSON(json));
    });

    it('isJSON test: Using non-JSON', () => {
        var notjson = 'test';
        assert(!h.isJSON(notjson));
    });

});

describe('Heart Rate Measurement classification:', () => {
    it('HR classification test: High', () => {
        var age = 45;
        var hr = 86; //Just above the high limit of normal for 45 y.o.
        var json = JSON.stringify({hr:hr,age:age});
        assert.equal(h.valueToDesc('HR',json), 'high');
    });

    it('HR classification test: Normal', () => {
        var age = 45;
        var hr = 70; //Normal for 45 y.o.
        var json = JSON.stringify({hr:hr,age:age});
        assert.equal(h.valueToDesc('HR',json), 'normal');
    });

    it('HR classification test: Low', () => {
        var age = 45;
        var hr = 60; //Just above the low limit of normal for 45 y.o.
        var json = JSON.stringify({hr:hr,age:age});
        assert.equal(h.valueToDesc('HR',json), 'low');
    });
});

describe('Blood Pressure Measurement classification:', () => {
    it('BP classification test: Normal', () => {
        var bps = 45;
        var bpd = 75;
        var json = JSON.stringify({bps:bps,bpd:bpd});
        assert.equal(h.valueToDesc('BP',json), 'normal');
    });

    it('BP classification test: Elevated', () => {
        var bps = 121;
        var bpd = 75;
        var json = JSON.stringify({bps:bps,bpd:bpd});
        assert.equal(h.valueToDesc('BP',json), 'elevated');
    });

    it('BP classification test: HT1', () => {
        var bps = 45;
        var bpd = 86;
        var json = JSON.stringify({bps:bps,bpd:bpd});
        assert.equal(h.valueToDesc('BP',json), 'ht1');
    });

    it('BP classification test: HT2', () => {
        var bps = 175;
        var bpd = 110;
        var json = JSON.stringify({bps:bps,bpd:bpd});
        assert.equal(h.valueToDesc('BP',json), 'ht2');
    });

    it('BP classification test: HTC', () => {
        var bps = 190;
        var bpd = 121;
        var json = JSON.stringify({bps:bps,bpd:bpd});
        assert.equal(h.valueToDesc('BP',json), 'htc');
    });
});