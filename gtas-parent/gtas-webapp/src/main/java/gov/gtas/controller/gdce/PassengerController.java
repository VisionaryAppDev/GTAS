package gov.gtas.controller.gdce;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import gov.gtas.model.Document;
import gov.gtas.model.Flight;
import gov.gtas.model.FlightPassenger;
import gov.gtas.model.Passenger;
import gov.gtas.model.PassengerDetails;
import gov.gtas.model.PassengerTripDetails;
import gov.gtas.querybuilder.exceptions.InvalidQueryException;
import gov.gtas.querybuilder.model.QueryRequest;
import gov.gtas.querybuilder.model.UserQuery;
import gov.gtas.querybuilder.service.QueryBuilderService;
import gov.gtas.repository.DocumentRepository;
import gov.gtas.repository.FlightPassengerRepository;
import gov.gtas.repository.PassengerDetailRepository;
import gov.gtas.repository.PassengerTripRepository;
import gov.gtas.repository.gdce.UserQueryRepository;
import gov.gtas.services.FlightService;
import gov.gtas.services.PassengerService;
import gov.gtas.services.dto.PassengersPageDto;
import gov.gtas.vo.passenger.DocumentVo;
import gov.gtas.vo.passenger.PassengerGridItemVo;

@RestController
public class PassengerController {

	@Autowired
	private PassengerService passengerService;

	@Autowired
	private PassengerDetailRepository passengerDetailRepo;

	@Autowired
	private PassengerTripRepository passengerTripDetailRepo;

	@Autowired
	private FlightService flightService;

	@Autowired
	private FlightPassengerRepository flightPassengerRepo;

	@Autowired
	private DocumentRepository documentRepo;

	@Autowired
	private UserQueryRepository userQueryRepo;

	@Autowired
	private QueryBuilderService queryService;

	
	@PostMapping("/{flightId}/passenger")
	public Passenger save(@PathVariable long flightId, @RequestBody Passenger passenger) throws Exception {
		Flight flight = flightService.findById(flightId);
		PassengerDetails pDetail = passenger.getPassengerDetails();
		PassengerTripDetails pTripDetail = passenger.getPassengerTripDetails();
		Set<Document> documents = passenger.getDocuments();

		if (flight == null)
			throw new Exception("Flight number could not be found");

		
		checkAgainstBlacklist(passenger);

		
		//
		passenger.setPassengerDetails(null);
		passenger.setPassengerTripDetails(null);
		passenger.setDocuments(null);

		//
		passenger = passengerService.create(passenger);
		

		//
		pDetail.setPassenger(passenger);
		pTripDetail.setPassenger(passenger);

		
		//
		passengerDetailRepo.save(pDetail);
		passengerTripDetailRepo.save(pTripDetail);
		saveDocs(documents, passenger);
		saveFlightPassenger(flight, passenger);
		checkAgainstCriteria(passenger, documents); // Rule only check after passenger info completely saved to db

		return passenger;
	}

	
	private void saveFlightPassenger(Flight flight, Passenger passenger) {
		FlightPassenger flightPassenger = new FlightPassenger();
		flightPassenger.setFlightId(flight.getId());
		flightPassenger.setPassengerId(passenger.getId());
		flightPassengerRepo.save(flightPassenger);
	}

	
	private final RestTemplate restTemplate = new RestTemplate();

	@Value("${BLACKLIST_HOST_IP}")
	private String BLACKLIST_HOST_IP = "http://10.1.8.129:8088";

	@Value("${TELEGRAM_TOKEN}")
	private String TELEGRAM_TOKEN = "";

	@Value("${TELEGRAM_GROUP_ID}")
	private String TELEGRAM_GROUP_ID = "";

	
	// TODO: Refactor...
	private void checkAgainstCriteria(Passenger passenger, Set<Document> documents) throws JsonParseException, JsonMappingException, IOException, InvalidQueryException {
		boolean isFound = false;
		Iterable<UserQuery> userQueries = userQueryRepo.findAll();

		for (UserQuery userQuery : userQueries) {
			ObjectMapper mapper = new ObjectMapper();
			QueryRequest queryRequest = mapper.readValue("{\"query\":" + userQuery.getQueryText() + "}", QueryRequest.class);
			PassengersPageDto passengersHitRule = queryService.runPassengerQuery(queryRequest);
			
			
			for (PassengerGridItemVo passengerHitRule : passengersHitRule.getPassengers()) {
				for (DocumentVo passengerHitRuleDocument : passengerHitRule.getDocuments()) {
					for (Document doc : documents) {
						boolean isPassport = passengerHitRuleDocument.getDocumentType().toUpperCase().equals("P");
						boolean isSameTypeDoc = passengerHitRuleDocument.getDocumentType().equals(doc.getDocumentType());
						boolean isMatchedDocNo = doc.getDocumentNumber().equals(passengerHitRuleDocument.getDocumentNumber());
						
						if (isFound == false && isPassport && isSameTypeDoc && isMatchedDocNo) {
							StringBuilder msg = new StringBuilder();
							msg.append("**Rule HIT **");
							msg.append("\nFirst name: " + passengerHitRule.getFirstName());
							msg.append("\nMiddle Name:" + passengerHitRule.getMiddleName());
							msg.append("\nLast name: " + passengerHitRule.getLastName());
							msg.append("\nGender:" + passengerHitRule.getGender());
							msg.append("\nFlight Number: " + passengerHitRule.getFlightNumber());
							msg.append("\nPassport number: " + doc.getDocumentNumber());
							
							sendTelegram(msg);
							isFound = true;
						}
					}
				}
			}
		}
	}

	// TODO return boolean. IF true then we should not check against rule...
	private void checkAgainstBlacklist(Passenger passenger) throws URISyntaxException {
		boolean isBlacklist = false;

		
		for (Document doc : passenger.getDocuments()) {
			if (doc.getDocumentType().toUpperCase().equals("P")) {
				// CHECK AGAINST FAKE SERVER IF THE PASSPORT IS IN BLACKLIST
				String baseUrl = BLACKLIST_HOST_IP + "/blacklists?passport=" + doc.getDocumentNumber();
				isBlacklist = restTemplate.getForEntity(baseUrl, Boolean.class).getBody();

				
				if (isBlacklist) {
					PassengerDetails pDetail = passenger.getPassengerDetails();
//					PassengerTripDetails pTripDetail = passenger.getPassengerTripDetails();

					
					// PREPARE TELEGRAM MESSAGE
					StringBuilder msg = new StringBuilder();
					msg.append("** Blacklist **");
					msg.append("\nFirst name: " + pDetail.getFirstName());
					msg.append("\nMiddle name: " + pDetail.getMiddleName());
					msg.append("\nLast name: " + pDetail.getLastName());
					msg.append("\nPassport number: " + doc.getDocumentNumber());
					
					
					sendTelegram(msg);
					break;
				}
			}
		}
	}
	

	private Object sendTelegram(StringBuilder msg) {
		String baseUrl = "https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage?chat_id=" + TELEGRAM_GROUP_ID + "&text=" + msg.toString();
		return restTemplate.getForEntity(baseUrl, Object.class);
	}

	
	private void saveDocs(Set<Document> docs, Passenger passenger) {
		docs.stream().map(doc -> {
			doc.setPassenger(passenger);
			return doc;
		}).collect(Collectors.toList());

		documentRepo.saveAll(docs);
	}
}
