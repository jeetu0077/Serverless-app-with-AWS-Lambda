'use strict';

var AWS = require('aws-sdk');

var dynamo = new AWS.DynamoDB();

exports.handler = function (event, context, callback) {
    dynamo.query({
        TableName: 'Chat-Messages',
        ProjectionExpression: '#T, Sender, Message',
        ExpressionAttributeNames: {'#T': 'Timestamp'},
        KeyConditionExpression: 'ConversationId = :id',
        ExpressionAttributeValues: {':id': {S: event.id}}
    }, function (err, data) {
        loadMessages(err, data, event.id, [], event.cognitoUsername, callback);
    });
}

function loadMessages(err, data, id, messages, username, callback) {
    if (err === null) {
        data.Items.forEach(function (message) {
            messages.push({
                sender: message.Sender.S,
                time: Number(message.Timestamp.N),
                message: message.Message.S
            });
        });
        if(data.LastEvaluatedKey) {
            dynamo.query({
                TableName: 'Chat-Messages',
                ProjectionExpression: '#T, Sender, Message',
                KeyConditionExpression: 'ConversationId = :id',
                ExpressionAttributeNames: {'#T': 'Timestamp'},
                ExpressionAttributeValues: {':id': {S: id}},
                ExclusiveStartKey: data.LastEvaluatedKey
            }, function (err, data) {
                loadMessages(err, data, id, messages, username, callback);
            });
        } else {
            loadConversationDetail(id, messages, username, callback);
        }
    } else {
        callback(err);
    }
}

function loadConversationDetail(id, messages, username, callback) {
    dynamo.query({
        TableName: 'Chat-Conversations',
        Select: 'ALL_ATTRIBUTES',
        KeyConditionExpression: 'ConversationId = :id',
        ExpressionAttributeValues: {':id': {S: id}}
    }, function (err, data) {
        if (err === null) {
            var participants = [];
            data.Items.forEach(function (item) {
                participants.push(item.Username.S);
            });

            if (!participants.includes(username)) {
                callback("unauthorized");
            }
            callback(null, {
                id: id,
                participants: participants,
                last: messages.length > 0 ? messages[messages.length-1].time : undefined,
                messages: messages
            });
        } else {
            callback(err);
        }
    });
}