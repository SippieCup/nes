'use strict';

const Url = require('url');

const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Lab = require('@hapi/lab');
const Nes = require('../');
const Teamwork = require('@hapi/teamwork');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Wildcard subscription routes', () => {

    const getUri = ({ protocol, address, port }) => Url.format({ protocol, hostname: address, port });

    it('publishes to wildcard route subscribers at different path levels', async () => {

        const server = Hapi.server();
        await server.register({ plugin: Nes, options: { auth: false } });

        server.subscription('/products/changes/{params*}');

        await server.start();

        const team = new Teamwork.Team({ meetings: 3 });

        const client1 = new Nes.Client(getUri(server.info));
        const client2 = new Nes.Client(getUri(server.info));
        const client3 = new Nes.Client(getUri(server.info));

        await client1.connect();
        await client2.connect();
        await client3.connect();

        const client1Messages = [];
        const client2Messages = [];
        const client3Messages = [];

        // Subscribe to root level - should get all messages
        await client1.subscribe('/products/changes/', (message) => {

            client1Messages.push(message);
            team.attend();
        });

        // Subscribe to update level - should get update messages
        await client2.subscribe('/products/changes/update', (message) => {

            client2Messages.push(message);
            team.attend();
        });

        // Subscribe to specific level - should get this specific message
        await client3.subscribe('/products/changes/update/5', (message) => {

            client3Messages.push(message);
            team.attend();
        });

        // Publish to most specific path
        server.publish('/products/changes/update/5', { action: 'update', id: 5 });

        await team.work;

        expect(client1Messages).to.have.length(1);
        expect(client2Messages).to.have.length(1);
        expect(client3Messages).to.have.length(1);

        expect(client1Messages[0]).to.equal({ action: 'update', id: 5 });
        expect(client2Messages[0]).to.equal({ action: 'update', id: 5 });
        expect(client3Messages[0]).to.equal({ action: 'update', id: 5 });

        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
        await server.stop();
    });

    it('publishes to optional parameter route subscribers', async () => {

        const server = Hapi.server();
        await server.register({ plugin: Nes, options: { auth: false } });

        server.subscription('/products/{action?}');

        await server.start();

        const team = new Teamwork.Team({ meetings: 2 });

        const client1 = new Nes.Client(getUri(server.info));
        const client2 = new Nes.Client(getUri(server.info));

        await client1.connect();
        await client2.connect();

        const client1Messages = [];
        const client2Messages = [];

        // Subscribe to root level with empty optional param
        await client1.subscribe('/products/', (message) => {

            client1Messages.push(message);
            team.attend();
        });

        // Subscribe to specific action
        await client2.subscribe('/products/update', (message) => {

            client2Messages.push(message);
            team.attend();
        });

        // Publish to specific action
        server.publish('/products/update', { action: 'update' });

        await team.work;

        expect(client1Messages).to.have.length(1);
        expect(client2Messages).to.have.length(1);

        expect(client1Messages[0]).to.equal({ action: 'update' });
        expect(client2Messages[0]).to.equal({ action: 'update' });

        client1.disconnect();
        client2.disconnect();
        await server.stop();
    });
});
