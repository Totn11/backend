import Booking from '../models/bookingModel.js';
import Resource from '../models/resourceModel.js';

const bookingManager = {
    processNewBooking: async (req, res) => {
        const { resourceId, timeSlot } = req.body;
        const userId = req.currentUser._id;

        try {
            // Check resource availability
            const targetResource = await Resource.findById(resourceId);
            if (!targetResource) {
                return res.status(404).json({
                    success: false,
                    message: 'Unable to locate the specified resource'
                });
            }

            // Verify slot availability
            if (!targetResource.availableSlots.includes(timeSlot)) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected time slot is no longer available'
                });
            }

            // Create booking record
            const bookingData = new Booking({
                userId,
                resourceId,
                timeSlot,
                status: 'confirmed'
            });

            const savedBooking = await bookingData.save();

            // Update resource availability
            targetResource.availableSlots = targetResource.availableSlots
                .filter(slot => slot !== timeSlot);
            await targetResource.save();

            res.status(201).json({
                success: true,
                data: savedBooking,
                message: 'Booking confirmed successfully'
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'Booking process failed',
                error: err.message
            });
        }
    },

    fetchUserBookings: async (req, res) => {
        const userId = req.currentUser._id;

        try {
            const userBookings = await Booking.find({ userId })
                .populate('resourceId', 'name description category')
                .sort('-createdAt');

            res.status(200).json({
                success: true,
                data: userBookings
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve booking history',
                error: err.message
            });
        }
    },

    modifyBooking: async (req, res) => {
        const { bookingId } = req.params;
        const { newTimeSlot } = req.body;
        const userId = req.currentUser._id;

        try {
            const existingBooking = await Booking.findOne({
                _id: bookingId,
                userId
            });

            if (!existingBooking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking record not found'
                });
            }

            const resource = await Resource.findById(existingBooking.resourceId);

            // Verify new slot availability
            if (!resource.availableSlots.includes(newTimeSlot)) {
                return res.status(400).json({
                    success: false,
                    message: 'Requested time slot is not available'
                });
            }

            // Free up old slot
            resource.availableSlots.push(existingBooking.timeSlot);
            
            // Update to new slot
            existingBooking.timeSlot = newTimeSlot;
            resource.availableSlots = resource.availableSlots
                .filter(slot => slot !== newTimeSlot);

            await Promise.all([
                existingBooking.save(),
                resource.save()
            ]);

            res.status(200).json({
                success: true,
                data: existingBooking,
                message: 'Booking updated successfully'
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'Failed to modify booking',
                error: err.message
            });
        }
    },

    cancelBooking: async (req, res) => {
        const { bookingId } = req.params;
        const userId = req.currentUser._id;

        try {
            const bookingToCancel = await Booking.findOne({
                _id: bookingId,
                userId
            });

            if (!bookingToCancel) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking record not found'
                });
            }

            const resource = await Resource.findById(bookingToCancel.resourceId);
            
            // Restore the slot
            resource.availableSlots.push(bookingToCancel.timeSlot);
            await resource.save();

            // Remove the booking
            await bookingToCancel.remove();

            res.status(200).json({
                success: true,
                message: 'Booking cancelled successfully'
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                message: 'Failed to cancel booking',
                error: err.message
            });
        }
    }
};

export default bookingManager;