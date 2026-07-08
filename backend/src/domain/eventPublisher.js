let io;

const configure = (socketServer) => {
  io = socketServer;
};

const emitToRooms = (eventName, payload, rooms = [], includeAdmin = true) => {
  if (!io) return;

  const targets = new Set([
    ...(includeAdmin ? ['admin'] : []),
    ...rooms.filter(Boolean),
  ]);
  let broadcaster = io;
  for (const room of targets) broadcaster = broadcaster.to(room);
  broadcaster.emit(eventName, payload);
};

const caseRooms = (payload) => [
  payload.caseId && `case:${payload.caseId}`,
  payload.customerId && `customer:${payload.customerId}`,
  payload.courierId && `courier:${payload.courierId}`,
  payload.inspectorId && `inspector:${payload.inspectorId}`,
];

export const EventPublisher = Object.freeze({
  configure,

  publishCaseUpdated(payload) {
    emitToRooms('case:updated', payload, caseRooms(payload));
  },

  publishPickupAssigned(payload) {
    emitToRooms('pickup:assigned', payload, caseRooms(payload));
  },

  publishPickupAccepted(payload) {
    emitToRooms('pickup:accepted', payload, caseRooms(payload));
  },

  publishInspectionStarted(payload) {
    emitToRooms('inspection:started', payload, caseRooms(payload));
  },

  publishInspectionAssigned(payload) {
    emitToRooms('inspection:assigned', payload, caseRooms(payload));
  },

  publishInspectionCompleted(payload) {
    emitToRooms('inspection:completed', payload, caseRooms(payload));
  },

  publishNotificationNew(payload) {
    emitToRooms(
      'notification:new',
      payload,
      [payload.recipientId && `user:${payload.recipientId}`],
      false,
    );
  },
});
