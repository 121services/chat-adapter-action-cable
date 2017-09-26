import ActionCable from 'actioncable';
import EventEmitter from 'events';

export default class ChatAdapterActionCable {
  constructor() {
    this._name = 'ChatAdapterActionCable';
    this._eventBus = new EventEmitter();
  }

  get name() {
    return this._name;
  }

  addChannelSubscriber(channelId, userId) {
    var self = this;

    return this._cable.subscriptions.create({channel: channelId, userId: userId}, {
      received(data) {
        self._eventBus.emit('ucw:newRemoteMessage', data);
      },
      // Called when the subscription is ready for use on the server
      connected() {
        console.debug('channel connected');
      },

      // Called when the WebSocket connection is closed
      disconnected() {
        console.debug('channel disconnected');
      },

      // Called when the subscription is rejected by the server
      rejected() {
        console.debug('channel rejected');
      }
    });
  }

  //
  // public API
  //
  init(config) {
    var url;

    this._backendUrl = config.backendUrl;
    // TODO *adapter.init json object to send to backend as initialization result will fire a ChatAdapter::onInit event
    this._initData = config.initData;
    // config.init.endpoint
    // config.init.method
    // config.init.data

    url = this._backendUrl + this._initData.endpoint;
    let self = this;

    return new Promise(function (resolve, reject) {
      fetch(url, {
        method: self._initData.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(self._initData.data)
      }).then(response => {
        if (response.ok) {
          response.json().then(json => {
            if (json.status !== 200) {
              reject(`${url} returned status ${json.status}: ${json.message}`);
              return;
            }

            if (json.wss_url === undefined || json.wss_url === '') {
              reject(`${url} did not provide a valid wss_url to open ActionCable web sockets`);
              return;
            }

            if (json.wss_channel_name === undefined || json.wss_channel_name === '') {
              reject(`${url} did not provide a valid wss_channel_name for ActionCable use`);
              return;
            }

            if (json.wss_channel_id === undefined || json.wss_channel_id === '') {
              reject(`${url} did not provide a valid wss_channel_id for ActionCable use`);
              return;
            }

            self._cable = ActionCable.createConsumer(json.wss_url);
            self._subscriber = self.addChannelSubscriber(json.wss_channel_name, json.wss_channel_id);

            if (json.older_messages_endpoint === undefined || json.older_messages_endpoint === '') {
              console.warn(`${url} did not provide a valid older_messages_endpoint.`);
            } else {
              self._olderMessagesEndpoint = json.older_messages_endpoint;
            }

            resolve(json);
          });
        } else {
          reject('HTTP error: ' + response.status);
        }
      }).catch(error => {
        reject(error.message);
      });
    });
  }

  send(data) {
    this._subscriber.send(data);
  }

  on(event, callback) {
    this._eventBus.on(event, callback);
  }

  requestOlderMessages(data) {
    var self = this;

    return new Promise(function (resolve, reject) {
      if (self._olderMessagesEndpoint === undefined || self._olderMessagesEndpoint === '') {
        reject('olderMessagesEndpoint is not defined. Unable to retrieve older messages');
      } else {
        let url = self._backendUrl + self._olderMessagesEndpoint;

        fetch(url, {
          method: 'post',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }).then(response => {
          if (response.ok) {
            response.json().then(json => {
              resolve(json);
            });
          } else {
            reject('HTTP error: ' + response.status);
          }
        }).catch(error => {
          reject(error.message);
        });
      }
    });
  }
}
