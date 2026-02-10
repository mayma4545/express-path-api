/**
 * EventService Tests
 * Tests for event CRUD operations and search functionality
 */

const EventService = require('../EventService');
const { Event, Nodes } = require('../../models');
const { Op } = require('sequelize');

// Mock the models
jest.mock('../../models', () => ({
  Event: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  Nodes: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('EventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveEvents', () => {
    const mockEvents = [
      {
        event_id: 1,
        event_name: 'Career Fair 2024',
        category: 'Career',
        start_datetime: new Date('2024-12-01T09:00:00'),
        end_datetime: new Date('2024-12-01T17:00:00'),
        is_active: true,
        location: {
          node_id: 1,
          name: 'Main Hall',
        },
      },
    ];

    it('should return active/upcoming events', async () => {
      Event.findAll.mockResolvedValue(mockEvents);

      const result = await EventService.getActiveEvents();

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
          }),
        })
      );
      expect(result).toEqual(mockEvents);
    });

    it('should filter events by search term', async () => {
      Event.findAll.mockResolvedValue([mockEvents[0]]);

      const result = await EventService.getActiveEvents({ search: 'Career' });

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            event_name: { [Op.like]: '%Career%' },
          }),
        })
      );
      expect(result).toEqual([mockEvents[0]]);
    });

    it('should filter events by category', async () => {
      Event.findAll.mockResolvedValue([mockEvents[0]]);

      const result = await EventService.getActiveEvents({ category: 'Career' });

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Career',
          }),
        })
      );
      expect(result).toEqual([mockEvents[0]]);
    });

    it('should filter events by from_date', async () => {
      Event.findAll.mockResolvedValue(mockEvents);

      const fromDate = '2024-11-01';
      const result = await EventService.getActiveEvents({ from_date: fromDate });

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            start_datetime: { [Op.gte]: new Date(fromDate) },
          }),
        })
      );
    });

    it('should include location data', async () => {
      Event.findAll.mockResolvedValue(mockEvents);

      await EventService.getActiveEvents();

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              model: Nodes,
              as: 'location',
            }),
          ]),
        })
      );
    });

    it('should order by start_datetime and event_name', async () => {
      Event.findAll.mockResolvedValue(mockEvents);

      await EventService.getActiveEvents();

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['start_datetime', 'ASC'], ['event_name', 'ASC']],
        })
      );
    });
  });

  describe('getAllEvents', () => {
    it('should return all events including past and inactive', async () => {
      const mockEvents = [
        { event_id: 1, event_name: 'Event 1', is_active: true },
        { event_id: 2, event_name: 'Event 2', is_active: false },
      ];

      Event.findAll.mockResolvedValue(mockEvents);

      const result = await EventService.getAllEvents();

      expect(Event.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockEvents);
    });

    it('should order by start_datetime DESC', async () => {
      Event.findAll.mockResolvedValue([]);

      await EventService.getAllEvents();

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['start_datetime', 'DESC'], ['event_name', 'ASC']],
        })
      );
    });
  });

  describe('getEventById', () => {
    const mockEvent = {
      event_id: 1,
      event_name: 'Career Fair 2024',
      location: { node_id: 1, name: 'Main Hall' },
    };

    it('should return event by ID with location', async () => {
      Event.findByPk.mockResolvedValue(mockEvent);

      const result = await EventService.getEventById(1);

      expect(Event.findByPk).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({
              model: Nodes,
              as: 'location',
            }),
          ]),
        })
      );
      expect(result).toEqual(mockEvent);
    });

    it('should return null if event not found', async () => {
      Event.findByPk.mockResolvedValue(null);

      const result = await EventService.getEventById(999);

      expect(result).toBeNull();
    });
  });

  describe('combinedSearch', () => {
    const mockEvents = [
      {
        event_id: 1,
        event_name: 'Career Fair',
        category: 'Career',
        location: { node_id: 1, name: 'Hall' },
      },
    ];

    const mockNodes = [
      { node_id: 1, name: 'Main Hall', building: 'Building A' },
    ];

    it('should search both events and nodes', async () => {
      Event.findAll.mockResolvedValue(mockEvents);
      Nodes.findAll.mockResolvedValue(mockNodes);

      const result = await EventService.combinedSearch('Career');

      expect(Event.findAll).toHaveBeenCalled();
      expect(Nodes.findAll).toHaveBeenCalled();
      expect(result.events).toHaveLength(1);
      expect(result.nodes).toHaveLength(1);
    });

    it('should return empty arrays for empty query', async () => {
      const result = await EventService.combinedSearch('');

      expect(Event.findAll).not.toHaveBeenCalled();
      expect(Nodes.findAll).not.toHaveBeenCalled();
      expect(result).toEqual({ events: [], nodes: [] });
    });

    it('should limit results to 10 items each', async () => {
      Event.findAll.mockResolvedValue([]);
      Nodes.findAll.mockResolvedValue([]);

      await EventService.combinedSearch('test');

      expect(Event.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
      expect(Nodes.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it('should add type property to results', async () => {
      Event.findAll.mockResolvedValue(mockEvents);
      Nodes.findAll.mockResolvedValue(mockNodes);

      const result = await EventService.combinedSearch('test');

      expect(result.events[0]).toHaveProperty('type', 'event');
      expect(result.nodes[0]).toHaveProperty('type', 'node');
    });
  });

  describe('createEvent', () => {
    const validEventData = {
      event_name: 'New Event',
      description: 'Test description',
      category: 'Academic',
      node_id: 1,
      start_datetime: '2024-12-01T09:00:00',
      end_datetime: '2024-12-01T17:00:00',
      is_active: true,
      is_featured: false,
    };

    it('should create event with valid data', async () => {
      const mockNode = { node_id: 1, name: 'Main Hall' };
      const mockCreatedEvent = { event_id: 1, ...validEventData };

      Nodes.findByPk.mockResolvedValue(mockNode);
      Event.create.mockResolvedValue(mockCreatedEvent);
      Event.findByPk.mockResolvedValue(mockCreatedEvent);

      const result = await EventService.createEvent(validEventData);

      expect(Nodes.findByPk).toHaveBeenCalledWith(1);
      expect(Event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'New Event',
          node_id: 1,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it('should throw error if node not found', async () => {
      Nodes.findByPk.mockResolvedValue(null);

      await expect(EventService.createEvent(validEventData)).rejects.toThrow(
        'Node not found'
      );
    });

    it('should validate start_datetime before end_datetime', async () => {
      const invalidEventData = {
        ...validEventData,
        start_datetime: '2024-12-01T17:00:00',
        end_datetime: '2024-12-01T09:00:00',
      };

      Nodes.findByPk.mockResolvedValue({ node_id: 1 });

      await expect(EventService.createEvent(invalidEventData)).rejects.toThrow(
        'Start datetime must be before end datetime'
      );
    });

    it('should handle null optional fields', async () => {
      const minimalEventData = {
        event_name: 'Minimal Event',
        node_id: 1,
      };

      Nodes.findByPk.mockResolvedValue({ node_id: 1 });
      Event.create.mockResolvedValue({ event_id: 1, ...minimalEventData });
      Event.findByPk.mockResolvedValue({ event_id: 1, ...minimalEventData });

      await EventService.createEvent(minimalEventData);

      expect(Event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          category: null,
          start_datetime: null,
          end_datetime: null,
        })
      );
    });
  });

  describe('updateEvent', () => {
    const mockEvent = {
      event_id: 1,
      event_name: 'Old Event',
      node_id: 1,
      start_datetime: new Date('2024-12-01T09:00:00'),
      end_datetime: new Date('2024-12-01T17:00:00'),
      update: jest.fn(),
    };

    it('should update event with valid data', async () => {
      const updateData = {
        event_name: 'Updated Event',
        category: 'Career',
      };

      Event.findByPk.mockResolvedValue(mockEvent);
      mockEvent.update.mockResolvedValue({ ...mockEvent, ...updateData });

      const result = await EventService.updateEvent(1, updateData);

      expect(Event.findByPk).toHaveBeenCalledWith(1);
      expect(mockEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'Updated Event',
          category: 'Career',
        })
      );
    });

    it('should return null if event not found', async () => {
      Event.findByPk.mockResolvedValue(null);

      const result = await EventService.updateEvent(999, {});

      expect(result).toBeNull();
    });

    it('should validate node_id if changed', async () => {
      Event.findByPk.mockResolvedValue(mockEvent);
      Nodes.findByPk.mockResolvedValue(null);

      await expect(
        EventService.updateEvent(1, { node_id: 999 })
      ).rejects.toThrow('Node not found');
    });

    it('should validate date logic on update', async () => {
      Event.findByPk.mockResolvedValue(mockEvent);

      await expect(
        EventService.updateEvent(1, {
          start_datetime: '2024-12-01T17:00:00',
          end_datetime: '2024-12-01T09:00:00',
        })
      ).rejects.toThrow('Start datetime must be before end datetime');
    });
  });

  describe('deleteEvent', () => {
    const mockEvent = {
      event_id: 1,
      event_name: 'Event to Delete',
      destroy: jest.fn(),
    };

    it('should delete event successfully', async () => {
      Event.findByPk.mockResolvedValue(mockEvent);
      mockEvent.destroy.mockResolvedValue(true);

      const result = await EventService.deleteEvent(1);

      expect(Event.findByPk).toHaveBeenCalledWith(1);
      expect(mockEvent.destroy).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        eventName: 'Event to Delete',
      });
    });

    it('should return null if event not found', async () => {
      Event.findByPk.mockResolvedValue(null);

      const result = await EventService.deleteEvent(999);

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return event statistics', async () => {
      Event.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // active
        .mockResolvedValueOnce(5) // upcoming
        .mockResolvedValueOnce(2); // past

      const result = await EventService.getStats();

      expect(result).toEqual({
        totalEvents: 10,
        activeEvents: 8,
        upcomingEvents: 5,
        pastEvents: 2,
      });
    });

    it('should call count with correct filters', async () => {
      Event.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await EventService.getStats();

      expect(Event.count).toHaveBeenCalledTimes(4);
      expect(Event.count).toHaveBeenNthCalledWith(1); // total
      expect(Event.count).toHaveBeenNthCalledWith(2, {
        where: { is_active: true },
      });
      expect(Event.count).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
            start_datetime: expect.any(Object),
          }),
        })
      );
    });
  });
});
