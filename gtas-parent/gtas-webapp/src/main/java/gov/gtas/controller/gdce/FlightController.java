package gov.gtas.controller.gdce;

import java.util.Date;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import gov.gtas.model.Flight;
import gov.gtas.model.MutableFlightDetails;
import gov.gtas.repository.MutableFlightDetailsRepository;
import gov.gtas.services.FlightService;

@RestController
public class FlightController {

	@Autowired
	private FlightService flightService;
	
	@Autowired
	private MutableFlightDetailsRepository mutableFlightDetailRepo;
	
	@PostMapping("/flight")
	public Flight save(@RequestBody Flight flight) {
		flight = flightService.create(flight);
		saveMutableFlightDetails(flight);
		
		return flight;
	}
	
	
	private void saveMutableFlightDetails(Flight flight) {
		MutableFlightDetails mutableFlightDetails = new MutableFlightDetails();
		mutableFlightDetails.setEta(new Date());
		mutableFlightDetails.setEtaDate(new Date());
		mutableFlightDetails.setEtd(new Date());
		mutableFlightDetails.setLocalEtaDate(new Date());
		mutableFlightDetails.setLocalEtdDate(new Date());
		mutableFlightDetails.setFlight(flight);
		mutableFlightDetails.setFlightId(flight.getId());
		
		mutableFlightDetailRepo.save(mutableFlightDetails);
	}
}
